<div align="center">

  <h1>BiR (Big Data Retriever)</h1>

  <p>
   There are plenty of interesting resources provided by Wikidata via its SPARQL endpoint. Develop a (micro-)service-based platform able to "intelligently" query, compare, visualize, share, summarize, etc. large (sets of) data/knowledge and additional resources. Also, this Web system will recommend related information and/or similar resources available in other languages. Various computations could be performed by using existing big data techniques and tools –explore Awesome Big Data and Awesome Data Engineering. Expose minimum 2 real-life use-cases – for instance, discovering the fine arts, dance, or music (styles/artists/organizations) influences in the last Y years in a specific geographical area. Additional knowledge: The Data Engineering Handbook.
  </p>


<p>
  <a href="https://github.com/Stefan1811/BiR---Big-Data-Retriever/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/Stefan1811/BiR---Big-Data-Retriever" alt="contributors" />
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/Stefan1811/BiR---Big-Data-Retriever" alt="last update" />
  </a>
  <a href="https://github.com/Stefan1811/BiR---Big-Data-Retriever/network/members">
    <img src="https://img.shields.io/github/forks/Stefan1811/BiR---Big-Data-Retriever" alt="forks" />
  </a>
  <a href="https://github.com/Stefan1811/BiR---Big-Data-Retriever/stargazers">
    <img src="https://img.shields.io/github/stars/Stefan1811/BiR---Big-Data-Retriever" alt="stars" />
  </a>
  <a href="https://github.com/Stefan1811/BiR---Big-Data-Retriever/issues/">
    <img src="https://img.shields.io/github/issues/Stefan1811/BiR---Big-Data-Retriever" alt="open issues" />
  </a>
</p>

<h4>
    <a href="#getting-started">Getting Started</a>
  <span> · </span>
    <a href="https://github.com/Stefan1811/BiR---Big-Data-Retriever/issues/">Report Bug</a>
  <span> · </span>
    <a href="#contact">Contact</a>
</h4>
</div>

<br />

## About the Project

**BiR (Big Data Retriever)** is a distributed system for discovering cultural data (music, fine arts) from **Wikidata**. It combines **Apache Spark** for Big Data analytics, **semantic AI search** with sentence-transformers, and **RDF knowledge graphs** to provide intelligent comparisons and recommendations.

### Key Capabilities
- **2000+ Bands & 3000+ Artworks** from Wikidata
- **AI Semantic Search** - Natural language queries like *"rock bands from UK in the 70s"*
- **Spark Analytics** - Compare countries/genres with diversity scoring and timeline analysis
- **Interactive Dashboards** - Real-time filtering and visualizations

### Tech Stack
- **Frontend**: React 19.2, Vite, Chart.js, Mantine UI
- **Backend**: Python Flask, Apache Spark (PySpark), Apache Jena Fuseki
- **Storage**: Redis 7, RDF/SPARQL
- **DevOps**: Docker, Docker Compose

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Minimum 8GB RAM

### Installation

```bash
# Clone the repository
git clone https://github.com/Stefan1811/BiR---Big-Data-Retriever.git
cd BiR---Big-Data-Retriever

# Start all services
docker-compose up -d --build

# Access the application
# Open http://localhost:5173 in your browser
```

The ETL pipeline runs automatically on first access, loading 2000+ bands and 3000+ artworks from Wikidata.

## Usage

### Example Queries
- **Basic Search**: "The Beatles", "Mona Lisa"
- **Semantic Search**: *"rock bands from UK in the 70s"*, *"Renaissance paintings from Italy"*
- **Compare Countries/Genres**: USA vs UK, Rock vs Jazz
- **Recommendations**: Find similar bands based on genre and location

### API Endpoints
| Endpoint | Description |
|----------|-------------|
| `/api/search/music/semantic` | AI semantic search |
| `/api/compare` | Spark-powered comparison |
| `/api/recommend` | Smart recommendations |
| `/api/stats/music` | Statistics with filtering |

Full API documentation: (https://github.com/Stefan1811/BiR---Big-Data-Retriever/blob/main/docs/openapi.yaml)

## License

MIT License - See `LICENSE` for details.

## Contact

**Bodescu Stefan Rares** - bodescustefan@gmail.com
<br />
**Enea Iustin Gabriel** - eneaiustingabriel@gmail.com

Project Link: [https://github.com/Stefan1811/BiR---Big-Data-Retriever/](https://github.com/Stefan1811/BiR---Big-Data-Retriever/)
Demo video: [https://www.youtube.com/watch?v=ns2E1qWOdiY](https://www.youtube.com/watch?v=ns2E1qWOdiY)

---
