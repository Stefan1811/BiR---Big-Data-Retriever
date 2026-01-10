from flask import Flask, jsonify, request
from SPARQLWrapper import SPARQLWrapper, JSON
from flask_cors import CORS
import os
import sys
import json
import redis
import requests
import threading
import time

app = Flask(__name__)
CORS(app)

REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'localhost')
FUSEKI_UPDATE_URL = f"http://{FUSEKI_HOST}:3030/bir/update"

# Conexiune Redis
try:
    cache = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
except:
    cache = None

wikidata = SPARQLWrapper("https://query.wikidata.org/sparql")
wikidata.setReturnFormat(JSON)
wikidata.addCustomHttpHeader("User-Agent", "BiR-StudentProject/1.0")

def transform_to_rdf(item):
    """Helper: JSON -> RDF"""
    def clean(text):
        return text.replace('"', '\\"').replace('\n', ' ')

    s = f"<{item['band']['value']}>"
    triples = []
    triples.append(f'{s} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/MusicGroup> .')
    
    if 'bandLabel' in item: triples.append(f'{s} <http://schema.org/name> "{clean(item["bandLabel"]["value"])}" .')
    if 'genreLabel' in item: triples.append(f'{s} <http://schema.org/genre> "{clean(item["genreLabel"]["value"])}" .')
    if 'countryLabel' in item: triples.append(f'{s} <http://schema.org/location> "{clean(item["countryLabel"]["value"])}" .')
    if 'startYear' in item: triples.append(f'{s} <http://schema.org/foundingDate> {item["startYear"]["value"]} .')
    if 'influencerLabel' in item: triples.append(f'{s} <http://schema.org/influencedBy> "{clean(item["influencerLabel"]["value"])}" .')

    return "\n".join(triples)

def etl_pipeline():
    time.sleep(10) # Așteptăm DB-urile
    print("🚀 [ETL] Starting Pipeline...", file=sys.stderr)
    
    if cache and cache.exists("music:all"):
        print("⚡ [ETL] Data cached in Redis. Skipping download.", file=sys.stderr)
        return

    try:
        # CITIM QUERY-UL DIN FOLDERUL EXTERN (AICI E SCHIMBAREA)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        query_path = os.path.join(base_dir, "queries/preload.sparql")
        
        with open(query_path, "r") as f:
            query = f.read()
        
        print("-> Downloading from Wikidata...", file=sys.stderr)
        wikidata.setQuery(query)
        results = wikidata.query().convert()
        bindings = results["results"]["bindings"]
        print(f"📦 [ETL] Extracted {len(bindings)} items.", file=sys.stderr)

        redis_pipeline = cache.pipeline() if cache else None
        rdf_batch = []
        seen_bands = set()

        for item in bindings:
            rdf_batch.append(transform_to_rdf(item)) # Pt Fuseki
            
            band_id = item["band"]["value"]
            if band_id not in seen_bands: # Pt Redis (fara duplicate)
                simple_obj = {
                    "id": band_id,
                    "name": item.get("bandLabel", {}).get("value", "Unknown"),
                    "genre": item.get("genreLabel", {}).get("value", "Unknown"),
                    "country": item.get("countryLabel", {}).get("value", "Unknown"),
                    "year": item.get("startYear", {}).get("value", "N/A")
                }
                if redis_pipeline: redis_pipeline.rpush("music:all", json.dumps(simple_obj))
                seen_bands.add(band_id)

        if redis_pipeline:
            # Delete old data first, then execute all rpush commands
            cache.delete("music:all")  # Delete BEFORE adding new data
            redis_pipeline.execute()  # Now execute all rpush commands
            print("✅ [ETL] Redis Loaded.", file=sys.stderr)

        # Batch load Fuseki (with authentication)
        chunk_size = 500
        fuseki_auth = ('admin', 'admin')  # Fuseki credentials
        for i in range(0, len(rdf_batch), chunk_size):
            chunk = rdf_batch[i:i+chunk_size]
            update_query = f"INSERT DATA {{ {' '.join(chunk)} }}"
            resp = requests.post(FUSEKI_UPDATE_URL, data={'update': update_query}, auth=fuseki_auth)
            if resp.status_code != 200:
                print(f"⚠️ [ETL] Fuseki batch {i//chunk_size} failed: {resp.status_code}", file=sys.stderr)

        print("✅ [ETL] Fuseki Knowledge Graph Ready.", file=sys.stderr)

    except Exception as e:
        print(f"❌ [ETL] Error: {e}", file=sys.stderr)

threading.Thread(target=etl_pipeline).start()

@app.route('/search/music', methods=['GET'])
def search_music():
    q = request.args.get('q', '').lower()
    if cache and cache.exists("music:all"):
        raw = cache.lrange("music:all", 0, -1)
        res = []
        for d in raw:
            obj = json.loads(d)
            if q in obj['genre'].lower() or q in obj['name'].lower():
                res.append(obj)
                if len(res) >= 50: break
        return jsonify(res)
    return jsonify([])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)