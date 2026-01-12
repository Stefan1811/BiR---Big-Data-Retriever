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
FUSEKI_QUERY_URL = f"http://{FUSEKI_HOST}:3030/bir/query"

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
def clean(text):
    """Clean text for RDF insertion"""
    if not text: return ""
    return text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ').replace('\r', ' ').strip()


def transform_to_rdf(item):
    """Transform music data to RDF triples"""
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
            triples.append(f'{s} <http://dbpedia.org/ontology/activeYearsStartYear> {item["startYear"]["value"]} .')

        # 6. Membru (Raw Data - un rând per membru)
        if 'memberLabel' in item:
            triples.append(f'{s} <http://schema.org/member> "{clean(item["memberLabel"]["value"])}" .')

        # 7. Premiu (Raw Data - un rând per premiu)
        if 'awardLabel' in item:
            triples.append(f'{s} <http://schema.org/award> "{clean(item["awardLabel"]["value"])}" .')

        return "\n".join(triples)
    except Exception as e:
        return ""


def transform_art_to_rdf(item):
    """Transform art data to RDF triples"""
    try:
        artwork_uri = item.get("artwork", {}).get("value", "")
        if not artwork_uri:
            return ""

        s = f"<{artwork_uri}>"
        triples = []

        # 1. Type
        triples.append(f'{s} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/VisualArtwork> .')

        # 2. Name
        if 'artworkLabel' in item:
            triples.append(f'{s} <http://schema.org/name> "{clean(item["artworkLabel"]["value"])}" .')

        # 3. Art Type/Form
        if 'typeLabel' in item:
            triples.append(f'{s} <http://schema.org/artform> "{clean(item["typeLabel"]["value"])}" .')

        # 4. Creator
        if 'creatorLabel' in item:
            triples.append(f'{s} <http://schema.org/creator> "{clean(item["creatorLabel"]["value"])}" .')

        # 5. Art Movement
        if 'movementLabel' in item:
            triples.append(f'{s} <http://schema.org/artMovement> "{clean(item["movementLabel"]["value"])}" .')

        # 6. Country/Location Created
        if 'countryLabel' in item:
            triples.append(f'{s} <http://schema.org/locationCreated> "{clean(item["countryLabel"]["value"])}" .')

        # 7. Date Created
        if 'date' in item:
            date_val = item['date']['value']
            if date_val and date_val != "N/A":
                triples.append(f'{s} <http://schema.org/dateCreated> "{date_val}" .')

        # 8. Material
        if 'materialLabel' in item:
            triples.append(f'{s} <http://schema.org/material> "{clean(item["materialLabel"]["value"])}" .')

        # 9. Current Location
        if 'locationLabel' in item:
            triples.append(f'{s} <http://schema.org/contentLocation> "{clean(item["locationLabel"]["value"])}" .')

        return "\n".join(triples)
    except Exception as e:
        return ""

# --- ETL LOGIC ---
def run_music_etl():
    """ETL Pipeline for Music Domain"""
    print("🚀 [MUSIC-ETL] Starting Music Pipeline...", file=sys.stderr)

    # Verificam cache-ul
    if cache and cache.exists("music:all"):
        count = cache.llen("music:all")
        if count > 100:
            print(f"⚡ [MUSIC-ETL] Data found in Redis ({count} items). Skipping download.", file=sys.stderr)
            return {"status": "skipped", "message": "Music data already in cache"}

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
        years_count = sum(1 for item in bindings if 'startYear' in item)
        print(f"   -> Items with startYear: {years_count}/{len(bindings)}", file=sys.stderr)

        for idx, item in enumerate(bindings):
            # RDF pt Fuseki (Adăugăm TOT, inclusiv duplicatele pt membri/premii)
            rdf = transform_to_rdf(item)
            if rdf: rdf_batch.append(rdf)

            # Debug: Print first RDF item
            if idx == 0 and rdf:
                print(f"   -> Sample RDF (first item):\n{rdf[:500]}", file=sys.stderr)
            
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

        print("\n✅ [MUSIC-ETL] Fuseki Knowledge Graph Ready.", file=sys.stderr)
        return {"status": "success", "items": len(bindings)}

    except Exception as e:
        print(f"❌ [MUSIC-ETL] Error: {e}", file=sys.stderr)
        return {"status": "error", "message": str(e)}


def run_art_etl():
    """ETL Pipeline for Art Domain"""
    print("🎨 [ART-ETL] Starting Art Pipeline...", file=sys.stderr)

    # Verificam cache-ul
    if cache and cache.exists("art:all"):
        count = cache.llen("art:all")
        if count > 100:
            print(f"⚡ [ART-ETL] Data found in Redis ({count} items). Skipping download.", file=sys.stderr)
            return {"status": "skipped", "message": "Art data already in cache"}

    try:
        # 1. CITIM QUERY-UL pentru Art
        base_dir = os.path.dirname(os.path.abspath(__file__))
        query_path = os.path.join(base_dir, "queries/art_preload.sparql")

        with open(query_path, "r") as f:
            query = f.read()

        print("-> Downloading artworks from Wikidata...", file=sys.stderr)
        wikidata.setQuery(query)

        results = wikidata.query().convert()
        bindings = results["results"]["bindings"]
        print(f"📦 [ART-ETL] Extracted {len(bindings)} artworks (Raw rows).", file=sys.stderr)

        # 2. PROCESARE PENTRU REDIS SI FUSEKI
        redis_pipeline = cache.pipeline() if cache else None
        rdf_batch = []
        seen_artworks = set()

        for idx, item in enumerate(bindings):
            # RDF pt Fuseki
            rdf = transform_art_to_rdf(item)
            if rdf: rdf_batch.append(rdf)

            if idx == 0 and rdf:
                print(f"   -> Sample RDF (first item):\n{rdf[:500]}", file=sys.stderr)

            # JSON pt Redis (unică per artwork ID)
            artwork_id = item.get("artwork", {}).get("value", "")
            if artwork_id and artwork_id not in seen_artworks:
                simple_obj = {
                    "id": artwork_id,
                    "name": item.get("artworkLabel", {}).get("value", "Unknown"),
                    "type": item.get("typeLabel", {}).get("value", "Unknown"),
                    "creator": item.get("creatorLabel", {}).get("value", "Unknown"),
                    "movement": item.get("movementLabel", {}).get("value", "Unknown"),
                    "country": item.get("countryLabel", {}).get("value", "Unknown"),
                    "date": item.get("date", {}).get("value", "N/A"),
                    "material": item.get("materialLabel", {}).get("value", "Unknown"),
                    "location": item.get("locationLabel", {}).get("value", "Unknown")
                }
                if redis_pipeline: redis_pipeline.rpush("art:all", json.dumps(simple_obj))
                seen_artworks.add(artwork_id)

        # 3. INCARCARE IN REDIS
        if redis_pipeline:
            cache.delete("art:all")
            redis_pipeline.execute()
            print(f"✅ [ART-ETL] Redis Loaded with {len(seen_artworks)} unique artworks.", file=sys.stderr)

        # 4. INCARCARE IN FUSEKI
        print("🔹 Starting Fuseki upload for art...", file=sys.stderr)

        chunk_size = 500
        fuseki_auth = ('admin', 'admin')

        for i in range(0, len(rdf_batch), chunk_size):
            chunk = rdf_batch[i:i+chunk_size]
            chunk = [line for line in chunk if line.strip()]

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

        print("\n✅ [ART-ETL] Fuseki Knowledge Graph Ready.", file=sys.stderr)
        return {"status": "success", "items": len(bindings)}

    except Exception as e:
        print(f"❌ [ART-ETL] Error: {e}", file=sys.stderr)
        return {"status": "error", "message": str(e)}


def run_unified_etl():
    """Run ETL for both Music and Art domains"""
    print("=" * 60, file=sys.stderr)
    print("🚀 [UNIFIED-ETL] Starting Unified ETL Pipeline", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    results = {}

    # Run Music ETL
    music_result = run_music_etl()
    results['music'] = music_result

    # Run Art ETL
    art_result = run_art_etl()
    results['art'] = art_result

    print("=" * 60, file=sys.stderr)
    print("✅ [UNIFIED-ETL] Pipeline Complete!", file=sys.stderr)
    print(f"   Music: {music_result.get('status')}", file=sys.stderr)
    print(f"   Art: {art_result.get('status')}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    return results

def background_etl():
    """Background thread to run unified ETL"""
    run_unified_etl()

if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
    threading.Thread(target=background_etl, daemon=True).start()

# --- ENDPOINTS ---
@app.route('/health')
def health():
    """Health check endpoint with status for both domains"""
    music_count = cache.llen("music:all") if cache else 0
    art_count = cache.llen("art:all") if cache else 0
    return jsonify({
        "service": "SPARQL Service (Unified ETL)",
        "redis_connected": cache is not None,
        "music_items": music_count,
        "art_items": art_count,
        "total_items": music_count + art_count
    })

@app.route('/etl/refresh', methods=['POST'])
def force_refresh():
    """Force refresh of both music and art data"""
    if cache:
        cache.delete("music:all")
        cache.delete("art:all")
    result = run_unified_etl()
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