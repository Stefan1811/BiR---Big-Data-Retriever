import { useState, useEffect } from 'react';
import { apiClient } from './api/client';
import SemanticCard from './components/SemanticCard';
import ForceGraph from './components/ForceGraph';

function App() {
  // --- STATE ---
  const [stats, setStats] = useState([]);
  const [influences, setInfluences] = useState([]);
  
  // Search State
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Graph State
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('United Kingdom');
  const [yearsBack, setYearsBack] = useState(30);

  // --- INITIAL LOAD ---
  useEffect(() => {
    // 1. Luăm statistici
    apiClient.get('/api/stats')
      .then(res => setStats(res.data))
      .catch(console.error);
    
    // 2. Încărcăm graful inițial
    fetchGraphData();
  }, []);

  // --- ACTIONS ---

  const fetchGraphData = () => {
    setLoadingGraph(true);
    apiClient.get(`/api/influences?country=${selectedCountry}&years=${yearsBack}`)
      .then(res => {
        setInfluences(res.data);
        setLoadingGraph(false);
      })
      .catch(() => setLoadingGraph(false));
  };

  // Funcție de căutare (apelată la buton sau Enter)
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

  // Căutare automată la tastare (Opțional - poți șterge onKeyDown dacă vrei doar buton)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  return (
    <div className="container">
      {/* --- HEADER --- */}
      <header>
        <div>
          <h1>🎸 BiR Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0' }}>
            Big Data Retriever & Recommendation Engine
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <span style={{ background: '#22c55e', color: 'black', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
             SYSTEM ONLINE
           </span>
        </div>
      </header>

      {/* --- SECȚIUNEA 1: SEARCH (ACUM ESTE SUS ȘI VIZIBILĂ) --- */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>🔍 Search Knowledge Base</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Search for a band (e.g. Metallica, Nirvana, Rock)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, fontSize: '1.1rem' }}
          />
          <button className="btn" onClick={performSearch} style={{ minWidth: '120px' }}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* REZULTATE CĂUTARE */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ color: 'var(--text-secondary)' }}>Found {searchResults.length} results in Cache:</h4>
            <div className="grid-results">
              {searchResults.map((band) => (
                <SemanticCard key={band.id} item={band} />
              ))}
            </div>
          </div>
        )}

        {/* Mesaj dacă nu găsim nimic după căutare */}
        {!isSearching && searchQuery.length > 1 && searchResults.length === 0 && (
          <p style={{ marginTop: '10px', color: 'orange' }}>
            No cached results found for "{searchQuery}". Try a broader term.
          </p>
        )}
      </div>

      {/* --- SECȚIUNEA 2: DASHBOARD (STATISTICI + GRAF) --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
        
        {/* STATISTICI (STANGA) */}
        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>📊 Global Stats</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Real-time data from Fuseki</p>
          <ul style={{ padding: 0, listStyle: 'none', marginTop: '1rem' }}>
            {stats.slice(0, 10).map((s, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{s.label}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* GRAF (DREAPTA) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, color: 'var(--accent)' }}>🕸️ Influence Graph</h3>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
                <option>United Kingdom</option>
                <option>United States of America</option>
                <option>Germany</option>
                <option>Sweden</option>
                <option>France</option>
              </select>
              <button className="btn" onClick={fetchGraphData} disabled={loadingGraph} style={{ fontSize: '0.9rem' }}>
                {loadingGraph ? 'Loading...' : 'Visualize'}
              </button>
            </div>
          </div>
          
          {/* Zona Grafului */}
          <div style={{ flex: 1, background: '#f0f0f0', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
             {influences.length > 0 ? (
               <ForceGraph data={influences} />
             ) : (
               <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#333' }}>
                 {loadingGraph ? 'Processing Relationships...' : 'No data for this filter.'}
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;