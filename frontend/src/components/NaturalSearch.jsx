import React, { useState } from 'react';

const NaturalSearch = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`http://localhost:8000/api/search/natural?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (res.status !== 200) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <h2 style={{ marginBottom: '20px', color: '#9333ea' }}>🔎 Semantic Music Search</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Try searching like: <br/>
        <em>"music styles in United Kingdom in the last 20 years"</em> <br/>
        <em>"influences from United States"</em>
      </p>

      {/* --- SEARCH BAR --- */}
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. music trends in Germany last 10 years..."
          style={{ 
            flex: 1, padding: '15px', borderRadius: '30px', border: '2px solid #9333ea', 
            fontSize: '1.1rem', outline: 'none'
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          onClick={handleSearch} 
          className="btn"
          style={{ 
            borderRadius: '30px', padding: '0 30px', fontSize: '1.1rem', 
            background: '#9333ea', color: 'white' 
          }}
          disabled={loading}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {/* --- ERROR --- */}
      {error && (
        <div style={{ marginTop: '20px', color: 'red', background: '#fee2e2', padding: '10px', borderRadius: '8px', display: 'inline-block' }}>
          ⚠️ {error}
        </div>
      )}

      {/* --- RESULTS --- */}
      {result && (
        <div style={{ marginTop: '40px', textAlign: 'left', maxWidth: '800px', margin: '40px auto 0' }}>
          <div style={{ background: '#9333ea', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <strong>Parsed Intent:</strong> 
            <span style={{ marginLeft: '10px', background: 'black', padding: '5px 10px', borderRadius: '15px', fontSize: '0.9rem' }}>
              📍 {result.parsed_intent.location}
            </span>
            <span style={{ marginLeft: '10px', background: 'black', padding: '5px 10px', borderRadius: '15px', fontSize: '0.9rem' }}>
              ⏳ {result.parsed_intent.time_frame}
            </span>
          </div>

          <h3>Top Results found:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {result.results.map((item, index) => (
              <div key={index} style={{ 
                background: 'white', border: '1px solid #e5e7eb', padding: '10px 20px', 
                borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{item.name}</span>
                <span style={{ background: '#9333ea', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          
          {result.results.length === 0 && <p>No data found matching your query.</p>}
        </div>
      )}
    </div>
  );
};

export default NaturalSearch;