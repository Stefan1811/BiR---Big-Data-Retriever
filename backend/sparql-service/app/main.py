from flask import Flask, jsonify, request
from SPARQLWrapper import SPARQLWrapper, JSON
from flask_cors import CORS
from flasgger import Swagger
import os
import sys
import json
import redis
import requests
import threading
import time

app = Flask(__name__)
CORS(app)

# 1. Configurare Swagger
app.config['SWAGGER'] = {
    'title': 'BiR SPARQL Service API',
    'uiversion': 3
}
swagger = Swagger(app)

# Configurare Mediu
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'localhost')
FUSEKI_UPDATE_URL = f"http://{FUSEKI_HOST}:3030/bir/update"

# Conexiune Redis
try:
    cache = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
    cache.ping()
    print("✅ Connected to Redis", file=sys.stderr)
except:
    print("⚠️ Redis not available", file=sys.stderr)
    cache = None

wikidata = SPARQLWrapper("https://query.wikidata.org/sparql")
wikidata.setReturnFormat(JSON)
wikidata.addCustomHttpHeader("User-Agent", "BiR-StudentProject/1.0")

# --- DATA TRANSFORMATION ---
def transform_to_rdf(item):
    def clean(text):
        if not text: return ""
        return text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ').replace('\r', ' ').strip()

    try:
        s = f"<{item['band']['value']}>"
        triples = []
        
        # 1. Type
        triples.append(f'{s} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/MusicGroup> .')
        
        # 2. Name
        if 'bandLabel' in item:
            triples.append(f'{s} <http://schema.org/name> "{clean(item["bandLabel"]["value"])}" .')
            
        # 3. Genre
        if 'genreLabel' in item:
            triples.append(f'{s} <http://schema.org/genre> "{clean(item["genreLabel"]["value"])}" .')
            
        # 4. Location
        if 'countryLabel' in item:
            triples.append(f'{s} <http://schema.org/location> "{clean(item["countryLabel"]["value"])}" .')
            
        # 5. Start Year
        if 'startYear' in item:
            triples.append(f'{s} <http://schema.org/foundingDate> {item["startYear"]["value"]} .')
        
        # --- ATRIBUTE NOI ADĂUGATE AICI ---

        # 6. Membru (Raw Data - un rând per membru)
        if 'memberLabel' in item:
            triples.append(f'{s} <http://schema.org/member> "{clean(item["memberLabel"]["value"])}" .')

        # 7. Premiu (Raw Data - un rând per premiu)
        if 'awardLabel' in item:
            triples.append(f'{s} <http://schema.org/award> "{clean(item["awardLabel"]["value"])}" .')

        return "\n".join(triples)
    except Exception as e:
        return ""

# --- ETL LOGIC ---
def run_etl():
    time.sleep(5) 
    print("🚀 [ETL] Starting Pipeline (Single Query Mode)...", file=sys.stderr)
    
    # Verificam cache-ul
    if cache and cache.exists("music:all"):
        count = cache.llen("music:all")
        if count > 100: 
            print(f"⚡ [ETL] Data found in Redis ({count} items). Skipping download.", file=sys.stderr)
            return {"status": "skipped", "message": "Data already in cache"}

    try:
        # 1. CITIM QUERY-UL
        base_dir = os.path.dirname(os.path.abspath(__file__))
        query_path = os.path.join(base_dir, "queries/preload.sparql")
        
        with open(query_path, "r") as f:
            query = f.read()
        
        print("-> Downloading from Wikidata (Limit defined in query)...", file=sys.stderr)
        wikidata.setQuery(query)
        
        # AICI SE POATE BLOCA DACĂ LIMITA E PREA MARE (timeout 60s)
        results = wikidata.query().convert()
        bindings = results["results"]["bindings"]
        print(f"📦 [ETL] Extracted {len(bindings)} items (Raw rows).", file=sys.stderr)

        # 2. PROCESARE PENTRU REDIS SI FUSEKI
        redis_pipeline = cache.pipeline() if cache else None
        rdf_batch = []
        seen_bands = set()

        for item in bindings:
            # RDF pt Fuseki (Adăugăm TOT, inclusiv duplicatele pt membri/premii)
            rdf = transform_to_rdf(item)
            if rdf: rdf_batch.append(rdf)
            
            # JSON pt Redis (Aici păstrăm lista curată, UNICĂ, doar ID-ul trupei pt Search)
            band_id = item["band"]["value"]
            if band_id not in seen_bands:
                simple_obj = {
                    "id": band_id,
                    "name": item.get("bandLabel", {}).get("value", "Unknown"),
                    "genre": item.get("genreLabel", {}).get("value", "Unknown"),
                    "country": item.get("countryLabel", {}).get("value", "Unknown"),
                    "year": item.get("startYear", {}).get("value", "N/A")
                }
                if redis_pipeline: redis_pipeline.rpush("music:all", json.dumps(simple_obj))
                seen_bands.add(band_id)

        # 3. INCARCARE IN REDIS
        if redis_pipeline:
            cache.delete("music:all") 
            redis_pipeline.execute()
            print(f"✅ [ETL] Redis Loaded with {len(seen_bands)} unique bands.", file=sys.stderr)

        # 4. INCARCARE IN FUSEKI
        print("🔹 Starting Fuseki upload...", file=sys.stderr)
        
        chunk_size = 500
        fuseki_auth = ('admin', 'admin') 

        for i in range(0, len(rdf_batch), chunk_size):
            chunk = rdf_batch[i:i+chunk_size]
            chunk = [line for line in chunk if line.strip()] # Eliminam linii goale
            
            if not chunk: continue

            update_query = f"INSERT DATA {{ {' '.join(chunk)} }}"
            
            try:
                resp = requests.post(
                    FUSEKI_UPDATE_URL, 
                    data={'update': update_query}, 
                    auth=fuseki_auth
                )
                
                if resp.status_code != 200:
                    print(f"⚠️ Batch {i} Error: {resp.status_code}", file=sys.stderr)
                else:
                    print(".", end="", file=sys.stderr, flush=True)

            except Exception as e:
                print(f"⚠️ Net Error: {e}", file=sys.stderr)

        print("\n✅ [ETL] Fuseki Knowledge Graph Ready.", file=sys.stderr)
        return {"status": "success", "items": len(bindings)}

    except Exception as e:
        print(f"❌ [ETL] Error: {e}", file=sys.stderr)
        return {"status": "error", "message": str(e)}

def background_etl():
    run_etl()

if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
    threading.Thread(target=background_etl).start()

# --- ENDPOINTS ---
@app.route('/health')
def health():
    redis_count = cache.llen("music:all") if cache else 0
    return jsonify({
        "service": "SPARQL Service",
        "redis_connected": cache is not None,
        "items_in_cache": redis_count
    })

@app.route('/etl/refresh', methods=['POST'])
def force_refresh():
    if cache: cache.delete("music:all")
    result = run_etl()
    return jsonify(result)

@app.route('/search/music', methods=['GET'])
def search_music():
    q = request.args.get('q', '').lower()
    if not cache: return jsonify({"error": "Database offline"}), 503

    raw_data = cache.lrange("music:all", 0, -1)
    results = []
    
    for d in raw_data:
        obj = json.loads(d)
        if q in obj['name'].lower() or q in obj['genre'].lower():
            results.append(obj)
            if len(results) >= 50: break
    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)