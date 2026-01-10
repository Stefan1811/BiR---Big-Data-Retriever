from flask import Flask, jsonify, request
from SPARQLWrapper import SPARQLWrapper, JSON
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'localhost')
FUSEKI_ENDPOINT = f"http://{FUSEKI_HOST}:3030/bir/query"

# Inițializăm clientul SPARQL
sparql = SPARQLWrapper(FUSEKI_ENDPOINT)
sparql.setReturnFormat(JSON)

# --- FIX-UL ESTE AICI: AUTENTIFICAREA ---
# Fuseki cere parolă acum, deci trebuie să i-o dăm și aici
sparql.setCredentials("admin", "admin")
# ----------------------------------------

@app.route('/stats', methods=['GET'])
def get_stats():
    """Statistici generale: Top țări"""
    query = """
    PREFIX schema: <http://schema.org/>
    SELECT ?country (COUNT(?band) as ?count)
    WHERE {
      ?band a schema:MusicGroup .
      ?band schema:location ?country .
    }
    GROUP BY ?country
    ORDER BY DESC(?count)
    LIMIT 10
    """
    try:
        sparql.setQuery(query)
        results = sparql.query().convert()
        
        # Formatăm frumos pentru Frontend
        stats = []
        for r in results["results"]["bindings"]:
            stats.append({
                "label": r["country"]["value"],
                "value": r["count"]["value"]
            })
        return jsonify(stats)
    except Exception as e:
        print(f"Eroare Fuseki Stats: {e}")
        return jsonify([])

@app.route('/influences', methods=['GET'])
def get_influences():
    """Date pentru Graficul de influență"""
    country_filter = request.args.get('country', 'United Kingdom')
    
    # Query complex: Returnează cine a influențat pe cine
    query = f"""
    PREFIX schema: <http://schema.org/>
    SELECT ?bandName ?influencerName ?genre
    WHERE {{
      ?band a schema:MusicGroup ;
            schema:name ?bandName ;
            schema:location "{country_filter}" ;
            schema:genre ?genre ;
            schema:influencedBy ?influencer .
            
      ?influencer schema:name ?influencerName .
    }}
    LIMIT 100
    """
    try:
        sparql.setQuery(query)
        results = sparql.query().convert()
        
        data = []
        for r in results["results"]["bindings"]:
            data.append({
                "band": r["bandName"]["value"],
                "influenced_by": r["influencerName"]["value"],
                "genre": r["genre"]["value"]
            })
        return jsonify(data)
    except Exception as e:
        print(f"Eroare Fuseki Graph: {e}")
        return jsonify([])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002)