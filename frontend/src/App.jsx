import { useState, useEffect } from 'react';
import { apiClient } from './api/client';
import SemanticCard from './components/SemanticCard';

function App() {
  const [query, setQuery] = useState('Rock');
  const [music, setMusic] = useState([]);
  const [stats, setStats] = useState([]);
  const [influences, setInfluences] = useState([]);
  
  // Analytics State
  const [country, setCountry] = useState('United Kingdom');
  const [years, setYears] = useState(20);

  useEffect(() => {
    apiClient.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
  }, []);

  const search = () => apiClient.get(`/api/music?q=${query}`).then(res => setMusic(res.data));
  
  const analyze = () => apiClient.get(`/api/influences?country=${country}&years=${years}`).then(res => setInfluences(res.data));

  return (
    <div style={{padding:'20px', fontFamily:'sans-serif'}}>
      <h1>BiR - Big Data Music</h1>

      {/* 1. Stats */}
      <div style={{background:'#eee', padding:'10px', marginBottom:'20px'}}>
        <h3>Top Countries (from Fuseki)</h3>
        {stats.map((s,i) => <span key={i} style={{marginRight:'10px'}}><b>{s.label}</b>: {s.value}</span>)}
      </div>

      {/* 2. Influence Discovery */}
      <div style={{border:'2px solid blue', padding:'10px', marginBottom:'20px'}}>
        <h3>Influence Discovery</h3>
        <select value={country} onChange={e=>setCountry(e.target.value)}>
           <option>United Kingdom</option><option>United States of America</option><option>Germany</option>
        </select>
        <input type="number" value={years} onChange={e=>setYears(e.target.value)} />
        <button onClick={analyze}>Analyze</button>
        <ul>
          {influences.map((inf, i) => <li key={i}>{inf.band} influenced by {inf.influenced_by}</li>)}
        </ul>
      </div>

      {/* 3. Search */}
      <input value={query} onChange={e=>setQuery(e.target.value)} />
      <button onClick={search}>Search Bands</button>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'10px', marginTop:'20px'}}>
        {music.map((m,i) => <SemanticCard key={i} item={m} />)}
      </div>
    </div>
  );
}
export default App;