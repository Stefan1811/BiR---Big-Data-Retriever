"""
Spark ETL Job for Fine Arts Domain
Uses PySpark for distributed processing of Wikidata artworks
"""
import os
import sys
import json
import requests
import redis
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lower, trim, regexp_replace, count, lit
from pyspark.sql.types import StructType, StructField, StringType
from SPARQLWrapper import SPARQLWrapper, JSON


class SparkArtETL:
    def __init__(self):
        self.spark_master = os.getenv("SPARK_MASTER", "spark://spark-master:7077")
        self.redis_host = os.getenv("REDIS_HOST", "redis")
        self.fuseki_host = os.getenv("FUSEKI_HOST", "fuseki")
        self.fuseki_update_url = f"http://{self.fuseki_host}:3030/bir/update"
        self.fuseki_query_url = f"http://{self.fuseki_host}:3030/bir/query"

        # Initialize Spark
        self.spark = SparkSession.builder \
            .appName("BiR-ArtETL") \
            .master(self.spark_master) \
            .config("spark.driver.memory", "1g") \
            .config("spark.executor.memory", "1g") \
            .getOrCreate()

        self.spark.sparkContext.setLogLevel("WARN")

        # Redis connection
        try:
            self.cache = redis.Redis(host=self.redis_host, port=6379, decode_responses=True)
        except:
            self.cache = None

        print(f"[SPARK-ETL] Initialized with Spark master: {self.spark_master}", file=sys.stderr)

    def check_data_exists(self):
        """Check if data already exists in Redis and Fuseki"""
        redis_has_data = self.cache and self.cache.exists("art:all") and self.cache.llen("art:all") > 100

        fuseki_has_data = False
        try:
            query = "SELECT (COUNT(*) AS ?count) WHERE { ?s a <http://schema.org/VisualArtwork> }"
            resp = requests.get(self.fuseki_query_url, params={'query': query},
                               headers={'Accept': 'application/sparql-results+json'})
            if resp.status_code == 200:
                cnt = int(resp.json()["results"]["bindings"][0]["count"]["value"])
                fuseki_has_data = cnt > 100
        except:
            pass

        return redis_has_data, fuseki_has_data

    def extract_from_wikidata(self):
        """Extract artworks from Wikidata using SPARQL"""
        print("[SPARK-ETL] Extracting data from Wikidata...", file=sys.stderr)

        query = """
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?artwork ?artworkLabel ?typeLabel ?creatorLabel
                        ?movementLabel ?countryLabel ?date ?materialLabel ?locationLabel
        WHERE {
          VALUES ?type { wd:Q3305213 wd:Q860861 wd:Q93184 wd:Q11060274 }
          ?artwork wdt:P31 ?type .
          ?artwork rdfs:label ?artworkLabel . FILTER(LANG(?artworkLabel) = "en")
          ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en")

          OPTIONAL {
            ?artwork wdt:P170 ?creator .
            ?creator rdfs:label ?creatorLabel . FILTER(LANG(?creatorLabel) = "en")
          }
          OPTIONAL {
            ?artwork wdt:P135 ?movement .
            ?movement rdfs:label ?movementLabel . FILTER(LANG(?movementLabel) = "en")
          }
          OPTIONAL {
            ?artwork wdt:P495 ?country .
            ?country rdfs:label ?countryLabel . FILTER(LANG(?countryLabel) = "en")
          }
          OPTIONAL { ?artwork wdt:P571 ?date . }
          OPTIONAL {
            ?artwork wdt:P186 ?material .
            ?material rdfs:label ?materialLabel . FILTER(LANG(?materialLabel) = "en")
          }
          OPTIONAL {
            ?artwork wdt:P276 ?location .
            ?location rdfs:label ?locationLabel . FILTER(LANG(?locationLabel) = "en")
          }
        }
        LIMIT 3000
        """

        wikidata = SPARQLWrapper("https://query.wikidata.org/sparql")
        wikidata.setReturnFormat(JSON)
        wikidata.addCustomHttpHeader("User-Agent", "BiR-SparkETL-StudentProject/1.0")
        wikidata.setQuery(query)

        results = wikidata.query().convert()
        bindings = results["results"]["bindings"]
        print(f"[SPARK-ETL] Extracted {len(bindings)} raw records from Wikidata", file=sys.stderr)

        return bindings

    def transform_with_spark(self, raw_data):
        """Transform data using Spark DataFrame operations"""
        print("[SPARK-ETL] Transforming data with Spark...", file=sys.stderr)

        # Convert to list of dicts for Spark
        rows = []
        for item in raw_data:
            rows.append({
                "artwork": item.get("artwork", {}).get("value", ""),
                "name": item.get("artworkLabel", {}).get("value", "Unknown"),
                "type": item.get("typeLabel", {}).get("value", "Unknown"),
                "creator": item.get("creatorLabel", {}).get("value", "Unknown"),
                "movement": item.get("movementLabel", {}).get("value", "Unknown"),
                "country": item.get("countryLabel", {}).get("value", "Unknown"),
                "date": item.get("date", {}).get("value", "N/A"),
                "material": item.get("materialLabel", {}).get("value", "Unknown"),
                "location": item.get("locationLabel", {}).get("value", "Unknown")
            })

        # Create Spark DataFrame
        schema = StructType([
            StructField("artwork", StringType(), True),
            StructField("name", StringType(), True),
            StructField("type", StringType(), True),
            StructField("creator", StringType(), True),
            StructField("movement", StringType(), True),
            StructField("country", StringType(), True),
            StructField("date", StringType(), True),
            StructField("material", StringType(), True),
            StructField("location", StringType(), True)
        ])

        df = self.spark.createDataFrame(rows, schema)
        print(f"[SPARK-ETL] Created DataFrame with {df.count()} rows", file=sys.stderr)

        # SPARK TRANSFORMATIONS
        # 1. Remove duplicates
        df = df.dropDuplicates(["artwork"])
        print(f"[SPARK-ETL] After deduplication: {df.count()} rows", file=sys.stderr)

        # 2. Clean text fields
        df = df.withColumn("name", trim(regexp_replace(col("name"), r'[\"\n\r]', ' ')))
        df = df.withColumn("creator", trim(regexp_replace(col("creator"), r'[\"\n\r]', ' ')))

        # 3. Filter out rows without valid artwork URI
        df = df.filter(col("artwork").isNotNull() & (col("artwork") != ""))

        # 4. Add lowercase columns for search
        df = df.withColumn("name_lower", lower(col("name")))
        df = df.withColumn("movement_lower", lower(col("movement")))

        print(f"[SPARK-ETL] Final transformed count: {df.count()} rows", file=sys.stderr)
        return df

    def compute_stats(self, df):
        """Pre-compute aggregations using Spark"""
        print("[SPARK-ETL] Computing statistics with Spark...", file=sys.stderr)

        # Top movements
        movements_df = df.groupBy("movement") \
            .agg(count("*").alias("count")) \
            .orderBy(col("count").desc()) \
            .limit(10)

        # Top countries
        countries_df = df.groupBy("country") \
            .agg(count("*").alias("count")) \
            .orderBy(col("count").desc()) \
            .limit(10)

        # Top creators
        creators_df = df.groupBy("creator") \
            .agg(count("*").alias("count")) \
            .orderBy(col("count").desc()) \
            .limit(10)

        movements = [{"label": r["movement"], "value": r["count"]} for r in movements_df.collect()]
        countries = [{"label": r["country"], "value": r["count"]} for r in countries_df.collect()]
        creators = [{"label": r["creator"], "value": r["count"]} for r in creators_df.collect()]

        print(f"[SPARK-ETL] Stats computed: {len(movements)} movements, {len(countries)} countries", file=sys.stderr)
        return {"movements": movements, "countries": countries, "creators": creators}

    def load_to_redis(self, df):
        """Load transformed data to Redis"""
        print("[SPARK-ETL] Loading to Redis...", file=sys.stderr)

        if not self.cache:
            print("[SPARK-ETL] Redis not available", file=sys.stderr)
            return False

        # Collect data (for small datasets this is OK)
        rows = df.select("artwork", "name", "type", "creator", "movement",
                         "country", "date", "material", "location").collect()

        # Clear old data first
        self.cache.delete("art:all")

        pipeline = self.cache.pipeline()
        for row in rows:
            obj = {
                "id": row["artwork"],
                "name": row["name"],
                "type": row["type"],
                "creator": row["creator"],
                "movement": row["movement"],
                "country": row["country"],
                "date": row["date"],
                "material": row["material"],
                "location": row["location"]
            }
            pipeline.rpush("art:all", json.dumps(obj))

        pipeline.execute()
        print(f"[SPARK-ETL] Loaded {len(rows)} artworks to Redis (art:all)", file=sys.stderr)
        return True

    def load_to_fuseki(self, df):
        """Load RDF triples to Fuseki"""
        print("[SPARK-ETL] Loading to Fuseki...", file=sys.stderr)

        rows = df.select("artwork", "name", "type", "creator", "movement",
                         "country", "date", "material", "location").collect()

        def clean(text):
            if text is None:
                return "Unknown"
            return text.replace('"', '\\"').replace('\n', ' ').replace('\r', '')

        # Build RDF triples
        triples = []
        for row in rows:
            s = f"<{row['artwork']}>"
            triples.append(f'{s} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/VisualArtwork> .')
            triples.append(f'{s} <http://schema.org/name> "{clean(row["name"])}" .')
            triples.append(f'{s} <http://schema.org/artform> "{clean(row["type"])}" .')
            triples.append(f'{s} <http://schema.org/creator> "{clean(row["creator"])}" .')
            triples.append(f'{s} <http://schema.org/artMovement> "{clean(row["movement"])}" .')
            triples.append(f'{s} <http://schema.org/locationCreated> "{clean(row["country"])}" .')
            if row["date"] and row["date"] != "N/A":
                triples.append(f'{s} <http://schema.org/dateCreated> "{row["date"]}" .')
            triples.append(f'{s} <http://schema.org/material> "{clean(row["material"])}" .')
            triples.append(f'{s} <http://schema.org/contentLocation> "{clean(row["location"])}" .')

        # Batch insert to Fuseki
        chunk_size = 500
        fuseki_auth = ('admin', 'admin')

        for i in range(0, len(triples), chunk_size):
            chunk = triples[i:i+chunk_size]
            update_query = f"INSERT DATA {{ {' '.join(chunk)} }}"
            try:
                resp = requests.post(self.fuseki_update_url, data={'update': update_query}, auth=fuseki_auth)
                if resp.status_code != 200:
                    print(f"[SPARK-ETL] Fuseki batch {i//chunk_size} failed: {resp.status_code}", file=sys.stderr)
            except Exception as e:
                print(f"[SPARK-ETL] Fuseki error: {e}", file=sys.stderr)

        print(f"[SPARK-ETL] Loaded {len(rows)} artworks to Fuseki", file=sys.stderr)
        return True

    def cache_stats(self, stats):
        """Cache pre-computed stats in Redis"""
        if not self.cache:
            return

        self.cache.set("art:stats", json.dumps(stats))
        print("[SPARK-ETL] Stats cached in Redis (art:stats)", file=sys.stderr)

    def sync_redis_from_fuseki(self):
        """Sync Redis cache from Fuseki (no Wikidata download needed)"""
        print("[SPARK-ETL] Syncing Redis from Fuseki...", file=sys.stderr)

        query = """
        SELECT ?artwork ?name ?type ?creator ?movement ?country ?date ?material ?location
        WHERE {
            ?artwork a <http://schema.org/VisualArtwork> .
            OPTIONAL { ?artwork <http://schema.org/name> ?name }
            OPTIONAL { ?artwork <http://schema.org/artform> ?type }
            OPTIONAL { ?artwork <http://schema.org/creator> ?creator }
            OPTIONAL { ?artwork <http://schema.org/artMovement> ?movement }
            OPTIONAL { ?artwork <http://schema.org/locationCreated> ?country }
            OPTIONAL { ?artwork <http://schema.org/dateCreated> ?date }
            OPTIONAL { ?artwork <http://schema.org/material> ?material }
            OPTIONAL { ?artwork <http://schema.org/contentLocation> ?location }
        }
        """

        try:
            resp = requests.get(self.fuseki_query_url, params={'query': query},
                               headers={'Accept': 'application/sparql-results+json'})
            if resp.status_code != 200:
                print(f"[SPARK-ETL] Fuseki query failed: {resp.status_code}", file=sys.stderr)
                return False

            bindings = resp.json()["results"]["bindings"]
            print(f"[SPARK-ETL] Found {len(bindings)} artworks in Fuseki.", file=sys.stderr)

            if not self.cache:
                return False

            # Clear old data first
            self.cache.delete("art:all")

            pipeline = self.cache.pipeline()
            seen = set()

            for item in bindings:
                artwork_id = item.get("artwork", {}).get("value", "")
                if artwork_id and artwork_id not in seen:
                    obj = {
                        "id": artwork_id,
                        "name": item.get("name", {}).get("value", "Unknown"),
                        "type": item.get("type", {}).get("value", "Unknown"),
                        "creator": item.get("creator", {}).get("value", "Unknown"),
                        "movement": item.get("movement", {}).get("value", "Unknown"),
                        "country": item.get("country", {}).get("value", "Unknown"),
                        "date": item.get("date", {}).get("value", "N/A"),
                        "material": item.get("material", {}).get("value", "Unknown"),
                        "location": item.get("location", {}).get("value", "Unknown")
                    }
                    pipeline.rpush("art:all", json.dumps(obj))
                    seen.add(artwork_id)

            pipeline.execute()
            print(f"[SPARK-ETL] Redis synced with {len(seen)} artworks from Fuseki.", file=sys.stderr)
            return True
        except Exception as e:
            print(f"[SPARK-ETL] Sync error: {e}", file=sys.stderr)
            return False

    def run(self):
        """Main ETL pipeline with Smart Fetch logic"""
        print("[SPARK-ETL] ========================================", file=sys.stderr)
        print("[SPARK-ETL] Starting Fine Arts Spark ETL Pipeline", file=sys.stderr)
        print("[SPARK-ETL] ========================================", file=sys.stderr)

        # Check if data exists
        redis_ok, fuseki_ok = self.check_data_exists()
        print(f"[SPARK-ETL] Current status: Redis={redis_ok}, Fuseki={fuseki_ok}", file=sys.stderr)

        # Case 1: Both have data -> Skip ETL entirely
        if redis_ok and fuseki_ok:
            print("[SPARK-ETL] Data exists in both Redis & Fuseki. Skipping ETL.", file=sys.stderr)
            self.spark.stop()
            return

        # Case 2: Fuseki has data but Redis empty -> Just sync Redis (no Wikidata needed)
        if fuseki_ok and not redis_ok:
            print("[SPARK-ETL] Fuseki has data, Redis empty. Syncing Redis from Fuseki...", file=sys.stderr)
            self.sync_redis_from_fuseki()
            self.spark.stop()
            return

        # Case 3: Neither has data OR only Redis has data -> Full ETL from Wikidata
        print("[SPARK-ETL] Starting full ETL from Wikidata...", file=sys.stderr)

        try:
            # EXTRACT
            raw_data = self.extract_from_wikidata()

            # TRANSFORM with Spark
            df = self.transform_with_spark(raw_data)

            # Compute stats
            stats = self.compute_stats(df)

            # LOAD
            self.load_to_redis(df)
            self.load_to_fuseki(df)
            self.cache_stats(stats)

            print("[SPARK-ETL] ========================================", file=sys.stderr)
            print("[SPARK-ETL] ETL Pipeline completed successfully!", file=sys.stderr)
            print("[SPARK-ETL] ========================================", file=sys.stderr)

        except Exception as e:
            print(f"[SPARK-ETL] ERROR: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()

        finally:
            self.spark.stop()
