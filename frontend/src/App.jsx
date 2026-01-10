import { useState, useEffect } from 'react';
import { apiClient } from './api/client';
import SemanticCard from './components/SemanticCard';
import ArtCard from './components/ArtCard';

function App() {
  // ========== MUSIC STATE ==========
  const [query, setQuery] = useState('Rock');
  const [music, setMusic] = useState([]);
  const [stats, setStats] = useState([]);
  const [influences, setInfluences] = useState([]);
  const [country, setCountry] = useState('United Kingdom');
  const [years, setYears] = useState(20);

  // ========== FINE ARTS STATE ==========
  const [artQuery, setArtQuery] = useState('Impressionism');
  const [artworks, setArtworks] = useState([]);
  const [artStats, setArtStats] = useState({ movements: [], countries: [] });
  const [artInfluences, setArtInfluences] = useState([]);
  const [artMovement, setArtMovement] = useState('Impressionism');

  // ========== TAB STATE ==========
  const [activeTab, setActiveTab] = useState('music');

  // ========== LANGUAGE STATE ==========
  const [language, setLanguage] = useState('en');

  // Load initial stats
  useEffect(() => {
    apiClient.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
    apiClient.get('/api/art/stats').then(res => setArtStats(res.data)).catch(console.error);
  }, []);

  // ========== MUSIC FUNCTIONS ==========
  const searchMusic = () => apiClient.get(`/api/music?q=${query}`).then(res => setMusic(res.data));
  const analyzeMusic = () => apiClient.get(`/api/influences?country=${country}&years=${years}`).then(res => setInfluences(res.data));

  // ========== FINE ARTS FUNCTIONS ==========
  const searchArt = () => apiClient.get(`/api/art?q=${artQuery}`).then(res => setArtworks(res.data));
  const analyzeArt = () => apiClient.get(`/api/art/influences?movement=${artMovement}`).then(res => setArtInfluences(res.data));

  return (
    <div style={{padding:'20px', fontFamily:'sans-serif', maxWidth:'1400px', margin:'0 auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h1 style={{margin:0}}>BiR - Big Data Retriever</h1>
        <div>
          <label style={{marginRight:'10px'}}>Language:</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={{padding:'5px'}}>
            <option value="en">English</option>
            <option value="ro">Română</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </div>

      {/* ========== TAB NAVIGATION ========== */}
      <div style={{display:'flex', gap:'10px', marginBottom:'20px', borderBottom:'2px solid #ddd', paddingBottom:'10px'}}>
        <button
          onClick={() => setActiveTab('music')}
          style={{
            padding:'10px 20px',
            cursor:'pointer',
            background: activeTab === 'music' ? '#4a90d9' : '#eee',
            color: activeTab === 'music' ? 'white' : 'black',
            border:'none',
            borderRadius:'4px 4px 0 0',
            fontWeight:'bold'
          }}
        >
          🎵 Music
        </button>
        <button
          onClick={() => setActiveTab('art')}
          style={{
            padding:'10px 20px',
            cursor:'pointer',
            background: activeTab === 'art' ? '#c9a227' : '#eee',
            color: activeTab === 'art' ? 'white' : 'black',
            border:'none',
            borderRadius:'4px 4px 0 0',
            fontWeight:'bold'
          }}
        >
          🎨 Fine Arts
        </button>
      </div>

      {/* ========== MUSIC TAB ========== */}
      {activeTab === 'music' && (
        <div>
          <h2>🎵 Music Domain</h2>

          {/* Stats */}
          <div style={{background:'#e8f4fc', padding:'15px', marginBottom:'20px', borderRadius:'8px'}}>
            <h3>Top Countries (from Fuseki)</h3>
            {stats.map((s,i) => (
              <span key={i} style={{marginRight:'15px', background:'#4a90d9', color:'white', padding:'5px 10px', borderRadius:'4px'}}>
                <b>{s.label}</b>: {s.value}
              </span>
            ))}
          </div>

          {/* Influence Discovery */}
          <div style={{border:'2px solid #4a90d9', padding:'15px', marginBottom:'20px', borderRadius:'8px'}}>
            <h3>Music Influence Discovery</h3>
            <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
              <select value={country} onChange={e=>setCountry(e.target.value)} style={{padding:'8px'}}>
                <option>United Kingdom</option>
                <option>United States of America</option>
                <option>Germany</option>
                <option>France</option>
                <option>Italy</option>
              </select>
              <label>Last <input type="number" value={years} onChange={e=>setYears(e.target.value)} style={{width:'60px', padding:'8px'}} /> years</label>
              <button onClick={analyzeMusic} style={{padding:'8px 15px', background:'#4a90d9', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>
                Analyze
              </button>
            </div>
            <ul style={{marginTop:'10px'}}>
              {influences.map((inf, i) => (
                <li key={i}><strong>{inf.band}</strong> influenced by <em>{inf.influenced_by}</em> ({inf.genre})</li>
              ))}
              {influences.length === 0 && <li style={{color:'#888'}}>Click "Analyze" to discover influences</li>}
            </ul>
          </div>

          {/* Search */}
          <div style={{marginBottom:'20px'}}>
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Search by genre or name..."
              style={{padding:'10px', width:'300px', marginRight:'10px'}}
            />
            <button onClick={searchMusic} style={{padding:'10px 20px', background:'#4a90d9', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>
              Search Bands
            </button>
          </div>

          {/* Results Grid */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'15px'}}>
            {music.map((m,i) => <SemanticCard key={i} item={m} />)}
          </div>
        </div>
      )}

      {/* ========== FINE ARTS TAB ========== */}
      {activeTab === 'art' && (
        <div>
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

          {/* Search */}
          <div style={{marginBottom:'20px'}}>
            <input
              value={artQuery}
              onChange={e=>setArtQuery(e.target.value)}
              placeholder="Search by artist, movement, type..."
              style={{padding:'10px', width:'300px', marginRight:'10px'}}
            />
            <button onClick={searchArt} style={{padding:'10px 20px', background:'#c9a227', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>
              Search Artworks
            </button>
          </div>

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
