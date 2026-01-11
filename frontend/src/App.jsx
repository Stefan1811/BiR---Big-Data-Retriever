import { useState, useEffect } from 'react';
import { apiClient } from './api/client';
import SemanticCard from './components/SemanticCard';

// IMPORTĂM COMPONENTELE DE ANALIZĂ
import SparkCompare from './components/SparkCompare'; 
import NaturalSearch from './components/NaturalSearch'; // <--- IMPORT NOU

function App() {
  // --- STATE ---
  const [stats, setStats] = useState([]);
  
  // Simple Search State
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // --- INITIAL LOAD ---
  useEffect(() => {
    // 1. Luăm statistici generale (din Node.js)
    apiClient.get('/api/stats')
      .then(res => setStats(res.data))
      .catch(console.error);
  }, []);

  // --- ACTIONS ---

  // Funcție de căutare simplă (Entity Search)
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
        <div style={{ textAlign: 'right' }}>
           <span style={{ background: '#22c55e', color: 'black', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
             SYSTEM ONLINE
           </span>
        </div>
      </header>

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

      {/* --- SECȚIUNEA 3: NATURAL LANGUAGE SEARCH (NOU) --- */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '2rem' }}>
        <NaturalSearch />
      </div>

    </div>
  );
}

export default App;