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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8003)