"""
Art Service - Search and Analytics for Fine Arts
Data is loaded by Spark ETL, this service only syncs Redis cache from Fuseki
"""
from flask import Flask, jsonify, request
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
FUSEKI_QUERY_URL = f"http://{FUSEKI_HOST}:3030/bir/query"

# Redis connection
try:
    cache = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
except:
    cache = None


def wait_for_fuseki(max_retries=30, delay=2):
    """Wait for Fuseki to be ready"""
    for i in range(max_retries):
        try:
            resp = requests.get(f"http://{FUSEKI_HOST}:3030/$/ping", timeout=2)
            if resp.status_code == 200:
                print(f"[ART-SERVICE] Fuseki ready after {i*delay}s", file=sys.stderr)
                return True
        except:
            pass
        print(f"[ART-SERVICE] Waiting for Fuseki... ({i+1}/{max_retries})", file=sys.stderr)
        time.sleep(delay)
    return False


def check_fuseki_has_data():
    """Check if Fuseki already has art data (loaded by Spark ETL)"""
    try:
        query = "SELECT (COUNT(*) AS ?count) WHERE { ?s a <http://schema.org/VisualArtwork> }"
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': query},
                           headers={'Accept': 'application/sparql-results+json'})
        if resp.status_code == 200:
            count = int(resp.json()["results"]["bindings"][0]["count"]["value"])
            return count > 100  # Minimum threshold
        return False
    except:
        return False


def sync_redis_from_fuseki():
    """Sync Redis cache from Fuseki (source of truth loaded by Spark ETL)"""
    print("[ART-SERVICE] Syncing Redis from Fuseki...", file=sys.stderr)

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
            print(f"[ART-SERVICE] Fuseki query failed: {resp.status_code}", file=sys.stderr)
            return False

        bindings = resp.json()["results"]["bindings"]
        print(f"[ART-SERVICE] Found {len(bindings)} artworks in Fuseki.", file=sys.stderr)

        if not cache:
            return False

        # Clear old data first
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
        print(f"[ART-SERVICE] Redis synced with {len(seen)} artworks from Fuseki.", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[ART-SERVICE] Sync error: {e}", file=sys.stderr)
        return False


def cache_sync_pipeline():
    """
    Cache Sync Pipeline - Only syncs Redis from Fuseki (Spark ETL loads the data)

    Flow:
    1. Wait for Fuseki to be ready
    2. Wait for Spark ETL to populate Fuseki (poll until data exists)
    3. Sync Redis cache from Fuseki
    """
    time.sleep(5)  # Initial wait

    if not wait_for_fuseki():
        print("[ART-SERVICE] Fuseki not available. Aborting.", file=sys.stderr)
        return

    print("[ART-SERVICE] Starting Cache Sync (Fuseki -> Redis)...", file=sys.stderr)

    # Check if Redis already has data
    redis_has_data = cache and cache.exists("art:all") and cache.llen("art:all") > 100

    if redis_has_data:
        print("[ART-SERVICE] Redis already has data. Skipping sync.", file=sys.stderr)
        return

    # Wait for Spark ETL to populate Fuseki (poll every 10 seconds, max 5 minutes)
    max_wait = 30  # 30 attempts * 10s = 5 minutes
    for i in range(max_wait):
        if check_fuseki_has_data():
            print("[ART-SERVICE] Fuseki has data from Spark ETL. Syncing...", file=sys.stderr)
            sync_redis_from_fuseki()
            return
        print(f"[ART-SERVICE] Waiting for Spark ETL to load data... ({i+1}/{max_wait})", file=sys.stderr)
        time.sleep(10)

    print("[ART-SERVICE] Timeout waiting for Spark ETL. No data available.", file=sys.stderr)


# Start cache sync in background thread
threading.Thread(target=cache_sync_pipeline, daemon=True).start()


@app.route('/search/art', methods=['GET'])
def search_art():
    """Search artworks in Redis cache"""
    q = request.args.get('q', '').lower()
    if cache and cache.exists("art:all"):
        raw = cache.lrange("art:all", 0, -1)
        res = []
        for d in raw:
            obj = json.loads(d)
            # Search in name, creator, movement, type
            if (q in obj['name'].lower() or
                q in obj['creator'].lower() or
                q in obj['movement'].lower() or
                q in obj['type'].lower()):
                res.append(obj)
                if len(res) >= 50:
                    break
        return jsonify(res)
    return jsonify([])


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
    year_from = int(request.args.get('year_from', '1800'))
    year_to = int(request.args.get('year_to', '1900'))

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


@app.route('/recommend/art', methods=['GET'])
def recommend_art():
    """Recommend similar artworks based on same creator or movement"""
    artwork_name = request.args.get('artwork_name')
    if not artwork_name:
        return jsonify([])

    sparql = f"""
    PREFIX schema: <http://schema.org/>
    SELECT DISTINCT ?similarName ?creator ?movement WHERE {{
        ?targetArt schema:name "{artwork_name}" ;
                   schema:creator ?creator .
        OPTIONAL {{ ?targetArt schema:artMovement ?movement . }}

        ?similarArt schema:creator ?creator ;
                    schema:name ?similarName .
        OPTIONAL {{ ?similarArt schema:artMovement ?simMovement . }}

        FILTER (?similarArt != ?targetArt)
    }} LIMIT 5
    """

    try:
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': sparql})
        data = resp.json()["results"]["bindings"]
        res = [{
            "name": i["similarName"]["value"],
            "reason": f"Same creator: {i['creator']['value']}"
        } for i in data]
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    redis_ok = cache and cache.ping()
    fuseki_ok = check_fuseki_has_data()
    redis_count = cache.llen("art:all") if cache else 0

    return jsonify({
        "status": "healthy" if redis_ok and fuseki_ok else "degraded",
        "redis": {"connected": redis_ok, "art_count": redis_count},
        "fuseki": {"has_data": fuseki_ok}
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8004)
