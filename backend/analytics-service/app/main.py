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


# ========== ART ANALYTICS ==========

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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002)