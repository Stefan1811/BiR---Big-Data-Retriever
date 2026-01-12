from flask import Flask, jsonify, request
from SPARQLWrapper import SPARQLWrapper, JSON
from flask_cors import CORS
import os
import requests

app = Flask(__name__)
CORS(app)

FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'localhost')
FUSEKI_ENDPOINT = f"http://{FUSEKI_HOST}:3030/bir/query"
FUSEKI_QUERY_URL = FUSEKI_ENDPOINT

sparql = SPARQLWrapper(FUSEKI_ENDPOINT)
sparql.setReturnFormat(JSON)

# --- FIX AUTENTIFICARE ---
sparql.setCredentials("admin", "admin")
# -------------------------

@app.route('/recommend', methods=['GET'])
def recommend():
    band_name = request.args.get('band_name', '')
    
    # Logică simplă: Găsește trupe din același gen și aceeași țară
    query = f"""
    PREFIX schema: <http://schema.org/>
    SELECT ?similarName
    WHERE {{
      ?target a schema:MusicGroup ;
              schema:name "{band_name}" ;
              schema:genre ?genre ;
              schema:location ?country .
              
      ?similar a schema:MusicGroup ;
               schema:name ?similarName ;
               schema:genre ?genre ;
               schema:location ?country .
               
      FILTER (?similarName != "{band_name}")
    }}
    LIMIT 5
    """
    try:
        sparql.setQuery(query)
        results = sparql.query().convert()
        
        recs = []
        for r in results["results"]["bindings"]:
            recs.append({"name": r["similarName"]["value"]})
        return jsonify(recs)
    except Exception as e:
        print(f"Eroare Fuseki Recs: {e}")
        return jsonify([])


# ========== ART RECOMMENDATIONS ==========

@app.route('/recommend/art', methods=['GET'])
def recommend_art():
    """Recommend similar artworks based on same creator"""
    artwork_name = request.args.get('artwork_name')
    if not artwork_name:
        return jsonify([])

    # Query simplu - caută în Redis cache
    try:
        # Găsește artwork-ul în Redis prin cache lookup
        import redis
        cache = redis.Redis(host=os.getenv('REDIS_HOST', 'localhost'), port=6379, decode_responses=True)

        # Citește toate artwork-urile din cache
        all_artworks_raw = cache.lrange("art:all", 0, -1)
        if not all_artworks_raw:
            return jsonify([])

        import json
        all_artworks = [json.loads(a) for a in all_artworks_raw]

        # Găsește artwork-ul țintă
        target = None
        for art in all_artworks:
            if artwork_name.lower() in art.get('name', '').lower():
                target = art
                break

        if not target:
            return jsonify([])

        # Găsește artworks similare (același creator)
        target_creator = target.get('creator', 'Unknown')
        similar = [
            {
                "name": art.get('name'),
                "reason": f"Same creator: {target_creator}"
            }
            for art in all_artworks
            if art.get('creator') == target_creator and art.get('name') != target.get('name')
        ][:5]

        return jsonify(similar)

    except Exception as e:
        print(f"Art recommend error: {e}")
        return jsonify([])


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8003)