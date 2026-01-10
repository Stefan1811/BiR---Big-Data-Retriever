from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'fuseki')
FUSEKI_QUERY_URL = f"http://{FUSEKI_HOST}:3030/bir/query"

@app.route('/stats/global', methods=['GET'])
def global_stats():
    # Statistici Top Tari
    sparql = """
    SELECT ?country (COUNT(?s) AS ?count) WHERE {
        ?s <http://schema.org/location> ?country .
    } GROUP BY ?country ORDER BY DESC(?count) LIMIT 10
    """
    try:
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': sparql})
        data = resp.json()["results"]["bindings"]
        stats = [{"label": i["country"]["value"], "value": i["count"]["value"]} for i in data]
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/influences', methods=['GET'])
def get_influences():
    # Use Case: Influente in ultimii X ani in tara Y
    country = request.args.get('country', 'United Kingdom')
    years = int(request.args.get('years', '20'))
    cutoff_year = 2026 - years

    sparql = f"""
    PREFIX schema: <http://schema.org/>
    SELECT ?bandName ?genre ?influencerName WHERE {{
        ?band schema:location "{country}" ;
              schema:name ?bandName ;
              schema:genre ?genre ;
              schema:foundingDate ?year ;
              schema:influencedBy ?influencerName .
        FILTER (?year >= {cutoff_year})
    }} LIMIT 100
    """
    try:
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': sparql})
        data = resp.json()["results"]["bindings"]
        res = [{
            "band": i["bandName"]["value"],
            "genre": i["genre"]["value"],
            "influenced_by": i["influencerName"]["value"]
        } for i in data]
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002)