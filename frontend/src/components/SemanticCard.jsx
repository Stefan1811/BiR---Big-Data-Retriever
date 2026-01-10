import React, { useState } from 'react';
import { apiClient } from '../api/client';

const SemanticCard = ({ item }) => {
  const [recs, setRecs] = useState([]);
  const [showRecs, setShowRecs] = useState(false);

  // DEBUG: Verifică în consolă dacă datele ajung aici
  console.log("Card Item:", item); 

  const fetchRecs = async () => {
    if(!showRecs) {
      try {
        const res = await apiClient.get(`/api/recommend?band_name=${encodeURIComponent(item.name)}`);
        setRecs(res.data);
      } catch (e) {
        console.error("Recs error", e);
      }
    }
    setShowRecs(!showRecs);
  };

  // Verificare de siguranță (dacă item e undefined)
  if (!item) return null;

  return (
    <div style={{
        border: '1px solid #ddd', 
        padding: '15px', 
        borderRadius: '8px', 
        background: 'white', 
        color: '#333',         // <--- ASTA LIPSEA! (Gri închis/Negru)
        marginBottom: '10px'   // <--- Puțin spațiu între carduri
    }}>
      <h3 style={{margin: '0 0 10px 0'}}>{item.name}</h3>
      <p style={{margin: 0}}>Genre: {item.genre} | Origin: {item.country}</p>
      
      <button onClick={fetchRecs} style={{
          cursor:'pointer', 
          padding:'5px 10px', 
          marginTop: '10px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
      }}>
        {showRecs ? 'Hide' : 'Show Similar'}
      </button>

      {showRecs && (
        <ul style={{fontSize:'0.9em', background:'#f1f1f1', padding:'10px', marginTop: '10px', borderRadius: '4px'}}>
          {recs.map((r, i) => <li key={i} style={{marginBottom: '5px'}}>{r.name}</li>)}
          {recs.length === 0 && <li>No similar bands found locally.</li>}
        </ul>
      )}
    </div>
  );
};

export default SemanticCard;