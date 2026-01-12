import sys
import os
import time
import re
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from SPARQLWrapper import SPARQLWrapper, JSON
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg, count, min as spark_min, max as spark_max
# --- IMPORTURI NOI PENTRU SCHEMĂ ---
from pyspark.sql.types import StructType, StructField, StringType, IntegerType

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
                try: year = int(year[:4])
                except: year = None

            data.append({
                "band": band,
                "location": loc,
                "genre": gen,
                "year": year,
                "target": target_value
            })
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
                "top_distribution": [], "avg_founded_year": "N/A", "era_range": "N/A"
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
        else:
            avg_val = "N/A"
            range_val = "N/A"

        return {
            "total_bands": count_bands,
            "diversity_score": round(diversity / count_bands * 100, 1) if count_bands > 0 else 0,
            "top_distribution": top_list,
            "avg_founded_year": avg_val,
            "era_range": range_val
        }

    stats1 = analyze_group(df1)
    stats2 = analyze_group(df2)

    overlap_count = df1.join(df2, "band").count()

    response = {
        "mode": mode,
        "comparison": f"{t1} vs {t2}",
        "data": {
            t1: stats1,
            t2: stats2
        },
        "overlap": overlap_count
    }
    
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