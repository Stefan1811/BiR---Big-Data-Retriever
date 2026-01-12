from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

SPARQL = "http://sparql-service:8001"
ANALYTICS = "http://analytics-service:8002"
REC = "http://recommendation-service:8003"
# ART service removed - functionality moved to other services

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

@app.route('/api/compare', methods=['GET'])
def compare():
    try:
        # Trimite toți parametrii (mode, t1, t2) automat
        response = requests.get(f"{ANALYTICS}/analytics/compare", params=request.args)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": "Gateway Error"}), 503

@app.route('/api/recommend', methods=['GET'])
def recommend():
    try: return jsonify(requests.get(f"{REC}/recommend", params=request.args).json())
    except: return jsonify([]), 503
    
@app.route('/api/search/natural', methods=['GET'])
def natural_search_proxy():
    try:
        response = requests.get(f"{ANALYTICS}/analytics/natural-search", params=request.args)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({"error": "Search Service Unavailable"}), 503

# --- FINE ARTS ROUTES ---

@app.route('/api/art', methods=['GET'])
def art():
    """Search artworks - now in sparql-service"""
    try: return jsonify(requests.get(f"{SPARQL}/search/art", params=request.args).json())
    except: return jsonify([]), 503

@app.route('/api/art/stats', methods=['GET'])
def art_stats():
    """Get art statistics - now in analytics-service"""
    try: return jsonify(requests.get(f"{ANALYTICS}/stats/art").json())
    except: return jsonify({}), 503

@app.route('/api/art/influences', methods=['GET'])
def art_influences():
    """Get artworks by movement - now in analytics-service"""
    try: return jsonify(requests.get(f"{ANALYTICS}/analytics/art-influences", params=request.args).json())
    except: return jsonify([]), 503

@app.route('/api/art/recommend', methods=['GET'])
def art_recommend():
    """Recommend similar artworks - now in recommendation-service"""
    try: return jsonify(requests.get(f"{REC}/recommend/art", params=request.args).json())
    except: return jsonify([]), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)