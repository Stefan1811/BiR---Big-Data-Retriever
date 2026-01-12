import { useState, useEffect } from 'react';
import { apiClient } from './api/client';
import SemanticCard from './components/SemanticCard';
import ArtCard from './components/ArtCard';
import NetworkGraph from './components/NetworkGraph';

// IMPORTĂM COMPONENTELE DE ANALIZĂ
import SparkCompare from './components/SparkCompare';
import NaturalSearch from './components/NaturalSearch';

// ========== SHARE/EXPORT UTILITIES (pentru Fine Arts) ==========
const exportToJSON = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] || '';
        const escaped = String(val).replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') ? `"${escaped}"` : escaped;
      }).join(',')
    )
  ];
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

function App() {
  // ========== TAB STATE ==========
  const [activeTab, setActiveTab] = useState('music');

  // ========== MUSIC STATE (Stefan) ==========
  const [stats, setStats] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // ========== FINE ARTS STATE ==========
  const [artQuery, setArtQuery] = useState('Impressionism');
  const [artworks, setArtworks] = useState([]);
  const [artStats, setArtStats] = useState({ movements: [], countries: [] });
  const [showGraph, setShowGraph] = useState(false);

  // ========== INITIAL LOAD ==========
  useEffect(() => {
    apiClient.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
    apiClient.get('/api/art/stats').then(res => setArtStats(res.data)).catch(console.error);
  }, []);

  // ========== MUSIC FUNCTIONS (Stefan) ==========
  const performSearch = () => {
    if (searchQuery.length > 1) {
      setIsSearching(true);
      apiClient.get(`/api/music?q=${searchQuery}`)
        .then(res => {
          setSearchResults(res.data);
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') performSearch();
  };

  // ========== FINE ARTS FUNCTIONS ==========
  const searchArt = () => apiClient.get(`/api/art?q=${artQuery}`).then(res => setArtworks(res.data));

  return (
    <div className="container" style={{ paddingBottom: '50px' }}>
      {/* --- HEADER --- */}
      <header>
        <div>
          <h1>🎸 BiR Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0' }}>
            Big Data Retriever & Spark Engine
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* TAB BUTTONS */}
          <button
            onClick={() => setActiveTab('music')}
            className={activeTab === 'music' ? 'btn' : ''}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: activeTab === 'music' ? 'none' : '1px solid var(--border)',
              background: activeTab === 'music' ? '' : 'transparent',
              color: activeTab === 'music' ? '' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            🎵 Music
          </button>
          <button
            onClick={() => setActiveTab('art')}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'art' ? '#c9a227' : 'transparent',
              color: activeTab === 'art' ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'art' ? '600' : 'normal'
            }}
          >
            🎨 Fine Arts
          </button>
          <span style={{ background: '#22c55e', color: 'black', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '10px' }}>
            SYSTEM ONLINE
          </span>
        </div>
      </header>

      {/* ========== MUSIC TAB (Stefan's Design) ========== */}
      {activeTab === 'music' && (
        <>
          {/* --- SECȚIUNEA 1: BASIC SEARCH (Căutare după nume) --- */}
          <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>🔍 Entity Search</h2>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Search for a specific band (e.g. Metallica, Nirvana)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ flex: 1, fontSize: '1.1rem' }}
              />
              <button className="btn" onClick={performSearch} style={{ minWidth: '120px' }}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* REZULTATE CĂUTARE SIMPLĂ */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ color: 'var(--text-secondary)' }}>Found {searchResults.length} results:</h4>
                <div className="grid-results">
                  {searchResults.map((band) => (
                    <SemanticCard key={band.id} item={band} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- SECȚIUNEA 2: DASHBOARD (STATISTICI + SPARK COMPARE) --- */}
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', marginBottom: '3rem' }}>

            {/* STATISTICI (STANGA) */}
            <div className="card" style={{ height: 'fit-content' }}>
              <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>📊 Global Stats</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Real-time Fuseki Data</p>
              <ul style={{ padding: 0, listStyle: 'none', marginTop: '1rem' }}>
                {stats.slice(0, 10).map((s, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{s.label}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* COMPONENTA SPARK COMPARISON (DREAPTA) */}
            <div>
               <SparkCompare />
            </div>
          </div>

          {/* --- SECȚIUNEA 3: NATURAL LANGUAGE SEARCH --- */}
          <div style={{ borderTop: '1px solid #333', paddingTop: '2rem' }}>
            <NaturalSearch />
          </div>
        </>
      )}

      {/* ========== FINE ARTS TAB (Dark Theme like Music) ========== */}
      {activeTab === 'art' && (
        <>
          {/* --- SECȚIUNEA 1: SEARCH --- */}
          <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>🔍 Artwork Search</h2>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Search by artist, movement, type..."
                value={artQuery}
                onChange={e => setArtQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchArt()}
                style={{ flex: 1, fontSize: '1.1rem' }}
              />
              <button className="btn" onClick={searchArt} style={{ minWidth: '120px' }}>
                Search
              </button>
            </div>

            {/* REZULTATE */}
            {artworks.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>Found {artworks.length} results:</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowGraph(!showGraph)}
                      className={showGraph ? 'btn' : ''}
                      style={{
                        padding: '6px 12px',
                        background: showGraph ? '' : 'transparent',
                        color: showGraph ? '' : 'var(--text-secondary)',
                        border: showGraph ? 'none' : '1px solid var(--border)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {showGraph ? 'Hide Graph' : 'Show Graph'}
                    </button>
                    <button
                      onClick={() => exportToJSON(artworks, 'bir-art-export')}
                      style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => exportToCSV(artworks, 'bir-art-export')}
                      style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      CSV
                    </button>
                  </div>
                </div>

                {/* Network Graph */}
                {showGraph && (
                  <div style={{ marginBottom: '20px' }}>
                    <NetworkGraph artworks={artworks} title="Artist-Movement-Country Relationships" />
                  </div>
                )}

                <div className="grid-results">
                  {artworks.map((a, i) => <ArtCard key={i} item={a} />)}
                </div>
              </div>
            )}
          </div>

          {/* --- SECȚIUNEA 2: STATS --- */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="card" style={{ height: 'fit-content' }}>
              <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>🎨 Top Movements</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Art movements by artwork count</p>
              <ul style={{ padding: 0, listStyle: 'none', marginTop: '1rem' }}>
                {artStats.movements && artStats.movements.slice(0, 8).map((s, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{s.label}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" style={{ height: 'fit-content' }}>
              <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>🌍 Top Countries</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Countries by artwork count</p>
              <ul style={{ padding: 0, listStyle: 'none', marginTop: '1rem' }}>
                {artStats.countries && artStats.countries.slice(0, 8).map((s, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{s.label}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
