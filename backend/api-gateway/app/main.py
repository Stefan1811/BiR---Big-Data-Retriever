from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

SPARQL = "http://sparql-service:8001"
ANALYTICS = "http://analytics-service:8002"
REC = "http://recommendation-service:8003"

@app.route('/api/music', methods=['GET'])
def music():
    try: return jsonify(requests.get(f"{SPARQL}/search/music", params=request.args).json())
    except: return jsonify([]), 503

@app.route('/api/stats', methods=['GET'])
def stats():
    try: return jsonify(requests.get(f"{ANALYTICS}/stats/global").json())
    except: return jsonify([]), 503

@app.route('/api/influences', methods=['GET'])
def influences():
    try: return jsonify(requests.get(f"{ANALYTICS}/analytics/influences", params=request.args).json())
    except: return jsonify([]), 503

@app.route('/api/recommend', methods=['GET'])
def recommend():
    try: return jsonify(requests.get(f"{REC}/recommend", params=request.args).json())
    except: return jsonify([]), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)