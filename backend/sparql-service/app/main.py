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
FUSEKI_QUERY_URL = f"http://{FUSEKI_HOST}:3030/bir/query"

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


# ========== ART SEARCH & SYNC ==========

def wait_for_fuseki(max_retries=30, delay=2):
    """Wait for Fuseki to be ready"""
    for i in range(max_retries):
        try:
            resp = requests.get(f"http://{FUSEKI_HOST}:3030/$/ping", timeout=2)
            if resp.status_code == 200:
                print(f"[SPARQL-SERVICE] Fuseki ready after {i*delay}s", file=sys.stderr)
                return True
        except:
            pass
        print(f"[SPARQL-SERVICE] Waiting for Fuseki... ({i+1}/{max_retries})", file=sys.stderr)
        time.sleep(delay)
    return False


def check_fuseki_has_art_data():
    """Check if Fuseki already has art data (loaded by Spark ETL)"""
    try:
        query = "SELECT (COUNT(*) AS ?count) WHERE { ?s a <http://schema.org/VisualArtwork> }"
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': query},
                           headers={'Accept': 'application/sparql-results+json'})
        if resp.status_code == 200:
            count = int(resp.json()["results"]["bindings"][0]["count"]["value"])
            return count > 100
        return False
    except:
        return False


def sync_art_redis_from_fuseki():
    """Sync Redis cache for art from Fuseki"""
    print("[SPARQL-SERVICE] Syncing Art Redis from Fuseki...", file=sys.stderr)

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
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': query},
                           headers={'Accept': 'application/sparql-results+json'})
        if resp.status_code != 200:
            print(f"[SPARQL-SERVICE] Fuseki query failed: {resp.status_code}", file=sys.stderr)
            return False

        bindings = resp.json()["results"]["bindings"]
        print(f"[SPARQL-SERVICE] Found {len(bindings)} artworks in Fuseki.", file=sys.stderr)

        if not cache:
            return False

        cache.delete("art:all")
        redis_pipeline = cache.pipeline()
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
                redis_pipeline.rpush("art:all", json.dumps(obj))
                seen.add(artwork_id)

        redis_pipeline.execute()
        print(f"[SPARQL-SERVICE] Redis synced with {len(seen)} artworks.", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[SPARQL-SERVICE] Art sync error: {e}", file=sys.stderr)
        return False


def art_cache_sync_pipeline():
    """Cache Sync Pipeline for Art - syncs Redis from Fuseki after Spark ETL loads data"""
    time.sleep(15)  # Wait for music ETL to finish first

    if not wait_for_fuseki():
        print("[SPARQL-SERVICE] Fuseki not available for art sync.", file=sys.stderr)
        return

    # Check if Redis already has art data
    if cache and cache.exists("art:all") and cache.llen("art:all") > 100:
        print("[SPARQL-SERVICE] Art Redis already has data. Skipping sync.", file=sys.stderr)
        return

    # Wait for Spark ETL to populate Fuseki with art data
    max_wait = 30
    for i in range(max_wait):
        if check_fuseki_has_art_data():
            print("[SPARQL-SERVICE] Fuseki has art data. Syncing...", file=sys.stderr)
            sync_art_redis_from_fuseki()
            return
        print(f"[SPARQL-SERVICE] Waiting for art data in Fuseki... ({i+1}/{max_wait})", file=sys.stderr)
        time.sleep(10)

    print("[SPARQL-SERVICE] Timeout waiting for art data.", file=sys.stderr)


# Start art cache sync in background
threading.Thread(target=art_cache_sync_pipeline, daemon=True).start()


@app.route('/search/art', methods=['GET'])
def search_art():
    """Search artworks in Redis cache"""
    q = request.args.get('q', '').lower()
    if cache and cache.exists("art:all"):
        raw = cache.lrange("art:all", 0, -1)
        res = []
        for d in raw:
            obj = json.loads(d)
            if (q in obj['name'].lower() or
                q in obj['creator'].lower() or
                q in obj['movement'].lower() or
                q in obj['type'].lower()):
                res.append(obj)
                if len(res) >= 50:
                    break
        return jsonify(res)
    return jsonify([])


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)