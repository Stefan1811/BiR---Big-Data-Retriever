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

const copyToClipboard = async (data) => {
  const text = JSON.stringify(data, null, 2);
  await navigator.clipboard.writeText(text);
  return true;
};

const generateShareableURL = (params) => {
  const url = new URL(window.location.href.split('?')[0]);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
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
  const [artInfluences, setArtInfluences] = useState([]);
  const [artMovement, setArtMovement] = useState('Impressionism');
  const [showGraph, setShowGraph] = useState(false);
  const [copyNotification, setCopyNotification] = useState('');

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
  const analyzeArt = () => apiClient.get(`/api/art/influences?movement=${artMovement}`).then(res => setArtInfluences(res.data));

  const handleShare = () => {
    const params = { tab: 'art', q: artQuery };
    const url = generateShareableURL(params);
    navigator.clipboard.writeText(url);
    setCopyNotification('Link copied!');
    setTimeout(() => setCopyNotification(''), 2000);
  };

  const handleCopyData = async () => {
    await copyToClipboard(artworks);
    setCopyNotification('Data copied!');
    setTimeout(() => setCopyNotification(''), 2000);
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

      {/* ========== FINE ARTS TAB (Original Design) ========== */}
      {activeTab === 'art' && (
        <div style={{padding:'20px', fontFamily:'sans-serif', background:'#fdfbf7', borderRadius:'12px', marginTop:'10px'}}>
          <h2>🎨 Fine Arts Domain</h2>

          {/* Stats */}
          <div style={{background:'#fff8e7', padding:'15px', marginBottom:'20px', borderRadius:'8px'}}>
            <h3>Top Art Movements</h3>
            {artStats.movements && artStats.movements.map((s,i) => (
              <span key={i} style={{marginRight:'15px', background:'#c9a227', color:'white', padding:'5px 10px', borderRadius:'4px', display:'inline-block', marginBottom:'5px'}}>
                <b>{s.label}</b>: {s.value}
              </span>
            ))}
            <h3 style={{marginTop:'15px'}}>Top Countries</h3>
            {artStats.countries && artStats.countries.map((s,i) => (
              <span key={i} style={{marginRight:'15px', background:'#8b6914', color:'white', padding:'5px 10px', borderRadius:'4px', display:'inline-block', marginBottom:'5px'}}>
                <b>{s.label}</b>: {s.value}
              </span>
            ))}
          </div>

          {/* Art Movement Analysis */}
          <div style={{border:'2px solid #c9a227', padding:'15px', marginBottom:'20px', borderRadius:'8px'}}>
            <h3>Art Movement Discovery</h3>
            <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
              <select value={artMovement} onChange={e=>setArtMovement(e.target.value)} style={{padding:'8px'}}>
                <option>Impressionism</option>
                <option>Renaissance</option>
                <option>Baroque</option>
                <option>Cubism</option>
                <option>Surrealism</option>
                <option>Romanticism</option>
                <option>Realism</option>
              </select>
              <button onClick={analyzeArt} style={{padding:'8px 15px', background:'#c9a227', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>
                Discover Artworks
              </button>
            </div>
            <ul style={{marginTop:'10px'}}>
              {artInfluences.map((art, i) => (
                <li key={i}><strong>{art.name}</strong> by <em>{art.creator}</em> ({art.country})</li>
              ))}
              {artInfluences.length === 0 && <li style={{color:'#888'}}>Click "Discover Artworks" to explore</li>}
            </ul>
          </div>

          {/* Search + Export Controls */}
          <div style={{marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'}}>
            <input
              value={artQuery}
              onChange={e=>setArtQuery(e.target.value)}
              placeholder="Search by artist, movement, type..."
              style={{padding:'10px', width:'300px'}}
            />
            <button onClick={searchArt} style={{padding:'10px 20px', background:'#c9a227', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>
              Search Artworks
            </button>
            <button
              onClick={() => setShowGraph(!showGraph)}
              style={{
                padding:'10px 20px',
                background: showGraph ? '#27ae60' : '#666',
                color:'white',
                border:'none',
                borderRadius:'4px',
                cursor:'pointer'
              }}
            >
              {showGraph ? 'Hide Network Graph' : 'Show Network Graph'}
            </button>

            {/* Separator */}
            <div style={{width:'1px', height:'30px', background:'#ddd', margin:'0 5px'}}></div>

            {/* Share/Export Buttons */}
            <button
              onClick={handleShare}
              title="Copy shareable link"
              style={{padding:'10px 15px', background:'#9b59b6', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
            >
              Share Link
            </button>
            <button
              onClick={() => exportToJSON(artworks, 'bir-art-export')}
              title="Download as JSON"
              style={{padding:'10px 15px', background:'#3498db', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
            >
              JSON
            </button>
            <button
              onClick={() => exportToCSV(artworks, 'bir-art-export')}
              title="Download as CSV"
              style={{padding:'10px 15px', background:'#e67e22', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
            >
              CSV
            </button>
            <button
              onClick={handleCopyData}
              title="Copy data to clipboard"
              style={{padding:'10px 15px', background:'#95a5a6', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
            >
              Copy
            </button>

            {/* Notification */}
            {copyNotification && (
              <span style={{padding:'8px 12px', background:'#27ae60', color:'white', borderRadius:'4px', fontSize:'13px', fontWeight:'bold'}}>
                {copyNotification}
              </span>
            )}
          </div>

          {/* Network Graph Visualization */}
          {showGraph && (
            <NetworkGraph
              artworks={artworks}
              title="Artist-Movement-Country Relationships"
            />
          )}

          {/* Results Grid */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'15px'}}>
            {artworks.map((a,i) => <ArtCard key={i} item={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
