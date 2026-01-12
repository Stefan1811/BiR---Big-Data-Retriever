from flask import Flask, jsonify, request
from SPARQLWrapper import SPARQLWrapper, JSON
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'localhost')
FUSEKI_ENDPOINT = f"http://{FUSEKI_HOST}:3030/bir/query"

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
    app.run(host='0.0.0.0', port=8003)