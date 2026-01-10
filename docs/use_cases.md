# BiR - Use Cases

## Overview
BiR (Big Data Retriever) is a microservices-based platform that queries Wikidata to build a local Knowledge Graph for music and fine arts domains.

---

## Use Case 1: Music Domain

### Description
Discover music bands, their influences, and relationships based on genre, country, and time period.

### User Story
As a music researcher, I want to find bands from a specific country and discover who influenced them, so I can study cultural transmission in music over time.

### Features
1. **Search Bands**: Search by genre or band name
2. **Influence Discovery**: Find bands influenced by others in a specific country during the last Y years
3. **Recommendations**: Find similar bands based on genre and country
4. **Statistics**: View top countries by number of bands

### Example Usage
1. Select "United Kingdom" and "20 years"
2. Click "Analyze" to discover UK bands and their influences
3. Search "Rock" to find all rock bands
4. Click "Show Similar" on a band card to get recommendations

### API Endpoints
- `GET /api/music?q=rock` - Search bands
- `GET /api/stats` - Get top countries
- `GET /api/influences?country=UK&years=20` - Discover influences
- `GET /api/recommend?band_name=Beatles` - Get similar bands

### Data Model
```
Band:
  - id: Wikidata URI
  - name: Band name
  - genre: Music genre
  - country: Country of origin
  - year: Founding year
  - influencedBy: List of influences
```

---

## Use Case 2: Fine Arts Domain

### Description
Explore visual artworks including paintings, sculptures, drawings, and prints from Wikidata. Discover art movements, artists, and relationships between artworks.

### User Story
As an art historian, I want to explore artworks by movement (Impressionism, Cubism, etc.) and discover artists who worked in similar styles, so I can understand the evolution of art movements.

### Features
1. **Search Artworks**: Search by artist name, movement, or artwork type
2. **Movement Discovery**: Find artworks belonging to specific art movements
3. **Recommendations**: Find similar artworks by the same artist
4. **Statistics**: View top art movements and countries

### Example Usage
1. Select "Impressionism" from the dropdown
2. Click "Discover Artworks" to find impressionist works
3. Search "Monet" to find artworks by Claude Monet
4. Click "Show Similar" on an artwork card to find related pieces

### API Endpoints
- `GET /api/art?q=impressionism` - Search artworks
- `GET /api/art/stats` - Get top movements and countries
- `GET /api/art/influences?movement=Impressionism` - Discover artworks by movement
- `GET /api/art/recommend?artwork_name=Mona Lisa` - Get similar artworks

### Data Model
```
Artwork:
  - id: Wikidata URI
  - name: Artwork title
  - type: painting/sculpture/drawing/print
  - creator: Artist name
  - movement: Art movement (Impressionism, etc.)
  - country: Country of origin
  - date: Creation date
  - material: Medium used (oil, bronze, etc.)
  - location: Current museum/location
```

### Supported Art Types
- **Paintings** (Q3305213): Oil paintings, watercolors, etc.
- **Sculptures** (Q860861): Bronze, marble, etc.
- **Drawings** (Q93184): Sketches, studies
- **Prints** (Q11060274): Engravings, lithographs

---

## Multi-Language Support

Both use cases support multiple languages:
- **English** (en)
- **Romanian** (ro)
- **French** (fr)

The SPARQL queries fetch labels in all three languages from Wikidata.

---

## Technical Implementation

### Architecture
```
Wikidata → ETL Pipeline → Redis (cache) + Fuseki (Knowledge Graph)
                              ↓
Frontend ← API Gateway ← [SPARQL/Analytics/Art Services]
```

### Knowledge Graph Schema
Uses schema.org vocabulary:
- `schema:MusicGroup` for bands
- `schema:VisualArtwork` for artworks
- Properties: name, genre, creator, location, dateCreated, etc.

### Data Sources
- **Wikidata**: Primary source for all data
- **SPARQL Endpoint**: https://query.wikidata.org/sparql

---

## Future Enhancements
- Add more art types (photography, architecture)
- Implement cross-domain recommendations (music + art from same era)
- Add timeline visualizations
- Support more languages
