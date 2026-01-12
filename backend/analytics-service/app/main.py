import sys
import os
import time
import re
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from SPARQLWrapper import SPARQLWrapper, JSON
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg, count, min as spark_min, max as spark_max, floor
# --- IMPORTURI NOI PENTRU SCHEMĂ ---
from pyspark.sql.types import StructType, StructField, StringType, IntegerType
from pyspark.sql.functions import lower, col, lit

app = Flask(__name__)
CORS(app)

# --- CONFIGURARE SPARK ---
spark = SparkSession.builder \
    .appName("BiR_Analytics_Engine") \
    .config("spark.driver.memory", "2g") \
    .config("spark.ui.showConsoleProgress", "false") \
    .getOrCreate()

DATA_LAKE_PATH = "/app/data_lake/comparisons"

FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'fuseki')
FUSEKI_ENDPOINT = f"http://{FUSEKI_HOST}:3030/bir/query"
sparql_client = SPARQLWrapper(FUSEKI_ENDPOINT)
sparql_client.setReturnFormat(JSON)

def clean_value(val):
    """Curăță URL-urile urâte și păstrează doar numele."""
    if not val: return "Unknown"
    if "http" in val:
        val = val.split('/')[-1].split('#')[-1]
    return val.replace('_', ' ')

def fetch_dynamic_data(criteria, target_value):
    print(f"📥 Fetching data for {criteria} = {target_value}...", file=sys.stderr)

    filter_logic = ""
    if criteria == 'country':
        filter_logic = f"""
        FILTER (
            contains(lcase(str(?location)), lcase("{target_value}"))
        )
        """
    elif criteria == 'genre':
        filter_logic = f"""
        FILTER (
            contains(lcase(str(?genreLabel)), lcase("{target_value}")) || 
            contains(lcase(str(?genre)), lcase("{target_value}"))
        )
        """

    query = f"""
    PREFIX schema: <http://schema.org/>
    PREFIX dbo: <http://dbpedia.org/ontology/>
    
    SELECT ?bandName ?location ?genre ?genreLabel ?startYear
    WHERE {{
      ?band a schema:MusicGroup ;
            schema:name ?bandName .
      
      OPTIONAL {{ ?band schema:location ?location }}
      
      ?band schema:genre ?genre .
      OPTIONAL {{ ?genre <http://www.w3.org/2000/01/rdf-schema#label> ?genreLabel }}
      
      OPTIONAL {{ ?band dbo:activeYearsStartYear ?startYear }}

      {filter_logic}
    }}
    LIMIT 3000
    """
    
    sparql_client.setQuery(query)
    try:
        results = sparql_client.query().convert()
        data = []
        years_found = 0
        for r in results["results"]["bindings"]:
            band = clean_value(r["bandName"]["value"])
            loc = clean_value(r["location"]["value"]) if "location" in r else "Unknown"

            if "genreLabel" in r:
                gen = clean_value(r["genreLabel"]["value"])
            elif "genre" in r:
                gen = clean_value(r["genre"]["value"])
            else:
                gen = "Unknown"

            year = r["startYear"]["value"] if "startYear" in r else None

            if year:
                try:
                    year = int(year[:4])
                    years_found += 1
                except: year = None

            data.append({
                "band": band,
                "location": loc,
                "genre": gen,
                "year": year,
                "target": target_value
            })
        print(f"✅ Fetched {len(data)} bands for {target_value}, {years_found} with years", file=sys.stderr)
        return data
    except Exception as e:
        print(f"❌ Error fetching {target_value}: {e}", file=sys.stderr)
        return []

@app.route('/analytics/compare', methods=['GET'])
def compare_universal():
    mode = request.args.get('mode', 'country')
    t1 = request.args.get('t1', 'United States')
    t2 = request.args.get('t2', 'United Kingdom')

    raw_data1 = fetch_dynamic_data(mode, t1)
    raw_data2 = fetch_dynamic_data(mode, t2)

    # Dacă nu găsim nimic, nu mai are sens să continuăm
    if not raw_data1 and not raw_data2:
         return jsonify({"error": f"Nu am găsit date nici pentru {t1}, nici pentru {t2}."}), 404

    # --- DEFINIRE SCHEMA EXPLICITĂ (AICI REPARĂM EROAREA) ---
    schema = StructType([
        StructField("band", StringType(), True),
        StructField("location", StringType(), True),
        StructField("genre", StringType(), True),
        StructField("year", IntegerType(), True), # Îi spunem forțat că e număr!
        StructField("target", StringType(), True)
    ])

    # Creăm DataFrame-urile folosind schema
    # (Dacă lista e goală, va crea un tabel gol cu structura corectă, fără erori)
    df1 = spark.createDataFrame(raw_data1 if raw_data1 else [], schema=schema)
    df2 = spark.createDataFrame(raw_data2 if raw_data2 else [], schema=schema)

    def analyze_group(df):
        # Dacă tabelul e gol, returnăm direct 0
        if df.count() == 0:
            return {
                "total_bands": 0, "diversity_score": 0,
                "top_distribution": [], "avg_founded_year": "N/A", "era_range": "N/A",
                "decade_breakdown": {}, "most_productive_decade": "N/A", "genre_uniqueness": 0
            }

        count_bands = df.count()
        pivot_col = "genre" if mode == 'country' else "location"

        diversity = df.select(pivot_col).distinct().count()
        top_items = df.groupBy(pivot_col).count().orderBy(col("count").desc()).limit(3).collect()
        top_list = [f"{row[pivot_col]} ({row['count']})" for row in top_items]

        # Calculăm anii doar dacă există valori non-null
        year_df = df.filter(col("year").isNotNull())
        if year_df.count() > 0:
            year_stats = year_df.select(
                avg("year").alias("avg_year"),
                spark_min("year").alias("oldest"),
                spark_max("year").alias("newest")
            ).collect()[0]

            avg_val = int(year_stats['avg_year'])
            range_val = f"{year_stats['oldest']} - {year_stats['newest']}"

            # --- NOI METRICI AVANSATE ---

            # 1. Breakdown pe decade
            decade_df = year_df.withColumn("decade", floor(col("year") / 10) * 10)
            decade_counts = decade_df.groupBy("decade").count().orderBy("decade").collect()
            decade_breakdown = {f"{int(row['decade'])}s": row['count'] for row in decade_counts}

            # 2. Cea mai productivă decadă
            most_productive = max(decade_counts, key=lambda x: x['count'], default=None)
            most_productive_decade = f"{int(most_productive['decade'])}s ({most_productive['count']} bands)" if most_productive else "N/A"

            # 3. Genre Uniqueness Score (numărul de genuri unice/rare cu < 5% din total)
            genre_counts = df.groupBy(pivot_col).count().collect()
            rare_genres = sum(1 for row in genre_counts if row['count'] < count_bands * 0.05)
            genre_uniqueness = round(rare_genres / len(genre_counts) * 100, 1) if genre_counts else 0

        else:
            avg_val = "N/A"
            range_val = "N/A"
            decade_breakdown = {}
            most_productive_decade = "N/A"
            genre_uniqueness = 0

        return {
            "total_bands": count_bands,
            "diversity_score": round(diversity / count_bands * 100, 1) if count_bands > 0 else 0,
            "top_distribution": top_list,
            "avg_founded_year": avg_val,
            "era_range": range_val,
            "decade_breakdown": decade_breakdown,
            "most_productive_decade": most_productive_decade,
            "genre_uniqueness": genre_uniqueness
        }

    print(f"📊 Analyzing group 1: {t1}...", file=sys.stderr)
    stats1 = analyze_group(df1)
    print(f"✅ Stats1: {stats1}", file=sys.stderr)

    print(f"📊 Analyzing group 2: {t2}...", file=sys.stderr)
    stats2 = analyze_group(df2)
    print(f"✅ Stats2: {stats2}", file=sys.stderr)

    # Calculăm overlap doar dacă ambele DataFrame-uri au date
    print(f"🔍 Calculating overlap...", file=sys.stderr)
    if df1.count() > 0 and df2.count() > 0:
        overlap_count = df1.join(df2, "band").count()
    else:
        overlap_count = 0
    print(f"✅ Overlap: {overlap_count}", file=sys.stderr)

    # --- METRICI COMPARATIVE CROSS-GROUP ---
    comparative_insights = {}

    if df1.count() > 0 and df2.count() > 0:
        pivot_col = "genre" if mode == 'country' else "location"

        # 1. Genuri/Locații comune
        genres1 = set([row[pivot_col] for row in df1.select(pivot_col).distinct().collect()])
        genres2 = set([row[pivot_col] for row in df2.select(pivot_col).distinct().collect()])

        common = genres1 & genres2
        unique_1 = genres1 - genres2
        unique_2 = genres2 - genres1

        comparative_insights["common_elements"] = list(common)[:5]
        comparative_insights["unique_to_" + t1.replace(" ", "_")] = list(unique_1)[:3]
        comparative_insights["unique_to_" + t2.replace(" ", "_")] = list(unique_2)[:3]

        # 2. "Winner" pe diferite categorii
        winner_diversity = t1 if stats1["diversity_score"] > stats2["diversity_score"] else t2
        winner_volume = t1 if stats1["total_bands"] > stats2["total_bands"] else t2

        comparative_insights["insights"] = {
            "more_diverse": winner_diversity,
            "more_prolific": winner_volume,
            "oldest_scene": t1 if isinstance(stats1["avg_founded_year"], int) and isinstance(stats2["avg_founded_year"], int) and stats1["avg_founded_year"] < stats2["avg_founded_year"] else t2
        }

    response = {
        "mode": mode,
        "comparison": f"{t1} vs {t2}",
        "data": {
            t1: stats1,
            t2: stats2
        },
        "overlap": overlap_count,
        "comparative_insights": comparative_insights
    }
    print(f"📤 Sending response: {response}", file=sys.stderr)
    
    try:
        record = [{"ts": time.time(), "mode": mode, "t1": t1, "t2": t2, "overlap": overlap_count}]
        # Aici nu mai definim schema că e simplu, Spark se descurcă
        spark.createDataFrame(record).write.mode("append").parquet(DATA_LAKE_PATH)
    except: pass

    return jsonify(response)
@app.route('/analytics/natural-search', methods=['GET'])
def natural_search():
    query_text = request.args.get('q', '').lower()
    
    # 1. PARSARE INTELIGENTĂ
    location_match = re.search(r'\b(in|from)\s+([a-zA-Z\s]+?)(?=\s+in\s+the\s+last|\s*$)', query_text)
    location = location_match.group(2).strip() if location_match else None
    
    years_match = re.search(r'last\s+(\d+)\s+years', query_text)
    years_ago = int(years_match.group(1)) if years_match else None
    
    print(f"🕵️ NLP Parsed: Loc={location}, Years={years_ago}", file=sys.stderr)

    if not location:
        return jsonify({"error": "Te rog specifică o locație (ex: 'in United States')."}), 400

    # 2. LOGICA PENTRU ANI (MODIFICATĂ)
    year_filter = ""
    if years_ago:
        current_year = datetime.now().year
        start_year = current_year - years_ago
        
        # --- SCHIMBAREA CRITICĂ AICI ---
        # !BOUND(?startYear) înseamnă: "Dacă variabila startYear NU EXISTĂ, e ok, trece mai departe".
        # Asta include trupele care nu au data setată în DB.
        year_filter = f"FILTER (!BOUND(?startYear) || ?startYear >= {start_year})"

    # 3. SPARQL QUERY
    query = f"""
    PREFIX schema: <http://schema.org/>
    PREFIX dbo: <http://dbpedia.org/ontology/>
    
    SELECT ?genre ?genreLabel (COUNT(?band) as ?count)
    WHERE {{
      ?band a schema:MusicGroup ;
            schema:name ?bandName .
      
      # Locația
      OPTIONAL {{ ?band schema:location ?location }}
      FILTER contains(lcase(str(?location)), lcase("{location}"))
      
      # Genul (Luăm și linkul ?genre ca rezervă)
      ?band schema:genre ?genre .
      OPTIONAL {{ ?genre <http://www.w3.org/2000/01/rdf-schema#label> ?genreLabel }}
      
      # Timpul
      OPTIONAL {{ ?band dbo:activeYearsStartYear ?startYear }}
      
      # Aplicăm filtrul "permisiv"
      {year_filter}
    }}
    GROUP BY ?genre ?genreLabel
    ORDER BY DESC(?count)
    LIMIT 15
    """
    
    print(f"🛠️ Generated SPARQL:\n{query}", file=sys.stderr) # Debug print

    sparql_client.setQuery(query)
    try:
        results = sparql_client.query().convert()
        data = []
        for r in results["results"]["bindings"]:
            # LOGICA DE FALLBACK PENTRU NUME
            if "genreLabel" in r:
                name = clean_value(r["genreLabel"]["value"])
            elif "genre" in r:
                name = clean_value(r["genre"]["value"]) # Luăm din Link!
            else:
                name = "Unknown Style"

            data.append({
                "name": name,
                "value": int(r["count"]["value"])
            })
        
        return jsonify({
            "parsed_intent": {
                "location": location,
                "time_frame": f"Last {years_ago} years" if years_ago else "All time"
            },
            "results": data
        })
        
    except Exception as e:
        print(f"❌ Error in NLP Search: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    
@app.route('/analytics/similar', methods=['GET'])
def get_similar_items():
    band_name = request.args.get('band', '')
    if not band_name:
        return jsonify([])

    print(f"⚡ Spark is finding similars for: {band_name}", file=sys.stderr)

    # 1. FETCH RAW DATA: Luăm TOT din Fuseki (nu filtrăm încă)
    # Aducem Numele și Genul pentru toate trupele din bază
    query = """
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?name ?genre ?genreLabel
    WHERE {
      ?s a schema:MusicGroup ;
         schema:name ?name .
      
      OPTIONAL { 
        ?s schema:genre ?genre .
        OPTIONAL { ?genre rdfs:label ?genreLabel }
      }
    }
    LIMIT 10000
    """
    
    sparql_client.setQuery(query)
    try:
        results = sparql_client.query().convert()
        raw_data = []
        
        for r in results["results"]["bindings"]:
            b_name = clean_value(r["name"]["value"])
            
            # Încercăm să luăm eticheta genului, dacă nu, curățăm linkul
            if "genreLabel" in r:
                g_val = r["genreLabel"]["value"]
            elif "genre" in r:
                g_val = clean_value(r["genre"]["value"])
            else:
                g_val = "Unknown"
                
            raw_data.append((b_name, g_val))
            
    except Exception as e:
        print(f"❌ Error fetching raw data: {e}", file=sys.stderr)
        return jsonify([])

    # 2. CREARE DATAFRAME SPARK
    schema = StructType([
        StructField("name", StringType(), True),
        StructField("genre", StringType(), True)
    ])
    
    # Încărcăm datele brute în Spark
    df = spark.createDataFrame(raw_data, schema=schema)

    # 3. PROCESARE SPARK
    
    # A. Găsim genul trupei căutate (ex: Daft Punk)
    # Filter: name == band_name (case insensitive)
    target_row = df.filter(lower(col("name")) == band_name.lower()).first()
    
    if not target_row:
        return jsonify([]) # Trupa nu există în datele noastre

    target_genre = target_row['genre']
    
    if target_genre == "Unknown":
         return jsonify([])

    # B. Găsim alte trupe cu același gen
    # Filter: genre == target_genre AND name != band_name
    similar_df = df.filter(
        (lower(col("genre")) == target_genre.lower()) & 
        (lower(col("name")) != band_name.lower())
    ).limit(5) # Luăm doar primele 5

    # 4. REZULTATE
    similars = similar_df.collect()
    
    output = []
    for row in similars:
        output.append({
            "name": row['name'],
            "reason": row['genre'] # Trimitem genul ca motiv al similarității
        })

    return jsonify(output)
    


# ========== ART ANALYTICS ==========

@app.route('/stats/art', methods=['GET'])
def art_stats():
    """Get art statistics from Fuseki - top movements and countries"""
    # Top Art Movements
    sparql_movements = """
    SELECT ?movement (COUNT(?s) AS ?count) WHERE {
        ?s <http://schema.org/artMovement> ?movement .
    } GROUP BY ?movement ORDER BY DESC(?count) LIMIT 10
    """

    # Top Countries
    sparql_countries = """
    SELECT ?country (COUNT(?s) AS ?count) WHERE {
        ?s <http://schema.org/locationCreated> ?country .
    } GROUP BY ?country ORDER BY DESC(?count) LIMIT 10
    """

    try:
        # Get movements
        resp_mov = requests.get(FUSEKI_QUERY_URL, params={'query': sparql_movements})
        movements = [{"label": i["movement"]["value"], "value": int(i["count"]["value"])}
                     for i in resp_mov.json()["results"]["bindings"]]

        # Get countries
        resp_cnt = requests.get(FUSEKI_QUERY_URL, params={'query': sparql_countries})
        countries = [{"label": i["country"]["value"], "value": int(i["count"]["value"])}
                     for i in resp_cnt.json()["results"]["bindings"]]

        return jsonify({
            "movements": movements,
            "countries": countries
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/analytics/art-influences', methods=['GET'])
def art_influences():
    """Get artworks by movement and time period"""
    movement = request.args.get('movement', 'Impressionism')

    sparql = f"""
    PREFIX schema: <http://schema.org/>
    SELECT ?name ?creator ?date ?country WHERE {{
        ?artwork schema:name ?name ;
                 schema:creator ?creator ;
                 schema:artMovement "{movement}" .
        OPTIONAL {{ ?artwork schema:dateCreated ?date . }}
        OPTIONAL {{ ?artwork schema:locationCreated ?country . }}
    }} LIMIT 100
    """

    try:
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': sparql})
        data = resp.json()["results"]["bindings"]
        res = [{
            "name": i["name"]["value"],
            "creator": i["creator"]["value"],
            "date": i.get("date", {}).get("value", "Unknown"),
            "country": i.get("country", {}).get("value", "Unknown")
        } for i in data]
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002)