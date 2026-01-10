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

# Redis connection
try:
    cache = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
except:
    cache = None

wikidata = SPARQLWrapper("https://query.wikidata.org/sparql")
wikidata.setReturnFormat(JSON)
wikidata.addCustomHttpHeader("User-Agent", "BiR-FineArts-StudentProject/1.0")


def transform_to_rdf(item):
    """Helper: JSON -> RDF triples for Fuseki"""
    def clean(text):
        return text.replace('"', '\\"').replace('\n', ' ')

    s = f"<{item['artwork']['value']}>"
    triples = []
    triples.append(f'{s} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/VisualArtwork> .')

    if 'artworkLabel' in item:
        triples.append(f'{s} <http://schema.org/name> "{clean(item["artworkLabel"]["value"])}" .')
    if 'typeLabel' in item:
        triples.append(f'{s} <http://schema.org/artform> "{clean(item["typeLabel"]["value"])}" .')
    if 'creatorLabel' in item:
        triples.append(f'{s} <http://schema.org/creator> "{clean(item["creatorLabel"]["value"])}" .')
    if 'movementLabel' in item:
        triples.append(f'{s} <http://schema.org/artMovement> "{clean(item["movementLabel"]["value"])}" .')
    if 'countryLabel' in item:
        triples.append(f'{s} <http://schema.org/locationCreated> "{clean(item["countryLabel"]["value"])}" .')
    if 'date' in item:
        triples.append(f'{s} <http://schema.org/dateCreated> "{item["date"]["value"]}" .')
    if 'materialLabel' in item:
        triples.append(f'{s} <http://schema.org/material> "{clean(item["materialLabel"]["value"])}" .')
    if 'locationLabel' in item:
        triples.append(f'{s} <http://schema.org/contentLocation> "{clean(item["locationLabel"]["value"])}" .')

    return "\n".join(triples)


def etl_pipeline():
    """ETL Pipeline: Extract from Wikidata, Transform to RDF, Load to Redis + Fuseki"""
    time.sleep(12)  # Wait for databases to start
    print("🎨 [ART-ETL] Starting Fine Arts Pipeline...", file=sys.stderr)

    if cache and cache.exists("art:all"):
        print("⚡ [ART-ETL] Data cached in Redis. Skipping download.", file=sys.stderr)
        return

    try:
        # Read SPARQL query from file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        query_path = os.path.join(base_dir, "queries/preload.sparql")

        with open(query_path, "r") as f:
            query = f.read()

        print("🖼️ [ART-ETL] Downloading artworks from Wikidata...", file=sys.stderr)
        wikidata.setQuery(query)
        results = wikidata.query().convert()
        bindings = results["results"]["bindings"]
        print(f"📦 [ART-ETL] Extracted {len(bindings)} artworks.", file=sys.stderr)

        redis_pipeline = cache.pipeline() if cache else None
        rdf_batch = []
        seen_artworks = set()

        for item in bindings:
            rdf_batch.append(transform_to_rdf(item))  # For Fuseki

            artwork_id = item["artwork"]["value"]
            if artwork_id not in seen_artworks:  # For Redis (no duplicates)
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
                if redis_pipeline:
                    redis_pipeline.rpush("art:all", json.dumps(simple_obj))
                seen_artworks.add(artwork_id)

        if redis_pipeline:
            # Delete old data first, then execute all rpush commands
            cache.delete("art:all")  # Delete BEFORE adding new data
            redis_pipeline.execute()  # Now execute all rpush commands
            print("✅ [ART-ETL] Redis Loaded with artworks.", file=sys.stderr)

        # Batch load to Fuseki (with authentication)
        chunk_size = 500
        fuseki_auth = ('admin', 'admin')  # Fuseki credentials
        for i in range(0, len(rdf_batch), chunk_size):
            chunk = rdf_batch[i:i+chunk_size]
            update_query = f"INSERT DATA {{ {' '.join(chunk)} }}"
            resp = requests.post(FUSEKI_UPDATE_URL, data={'update': update_query}, auth=fuseki_auth)
            if resp.status_code != 200:
                print(f"⚠️ [ART-ETL] Fuseki batch {i//chunk_size} failed: {resp.status_code}", file=sys.stderr)

        print("✅ [ART-ETL] Fuseki Knowledge Graph Ready with Fine Arts.", file=sys.stderr)

    except Exception as e:
        print(f"❌ [ART-ETL] Error: {e}", file=sys.stderr)


# Start ETL in background thread
threading.Thread(target=etl_pipeline).start()


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8004)
