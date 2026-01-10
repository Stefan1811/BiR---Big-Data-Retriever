from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

FUSEKI_HOST = os.getenv('FUSEKI_HOST', 'fuseki')
FUSEKI_QUERY_URL = f"http://{FUSEKI_HOST}:3030/bir/query"

@app.route('/recommend', methods=['GET'])
def recommend():
    band_name = request.args.get('band_name')
    if not band_name: return jsonify([])

    sparql = f"""
    PREFIX schema: <http://schema.org/>
    SELECT DISTINCT ?similarBandName ?genre ?country WHERE {{
        ?targetBand schema:name "{band_name}" ;
                    schema:genre ?genre ;
                    schema:location ?country .
        ?similarBand schema:genre ?genre ;
                     schema:location ?country ;
                     schema:name ?similarBandName .
        FILTER (?similarBand != ?targetBand)
    }} LIMIT 5
    """
    try:
        resp = requests.get(FUSEKI_QUERY_URL, params={'query': sparql})
        data = resp.json()["results"]["bindings"]
        res = [{
            "name": i["similarBandName"]["value"],
            "reason": f"Same genre ({i['genre']['value']}) & origin ({i['country']['value']})"
        } for i in data]
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8003)