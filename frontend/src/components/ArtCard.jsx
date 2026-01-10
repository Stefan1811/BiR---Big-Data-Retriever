import React, { useState } from 'react';
import { apiClient } from '../api/client';

const ArtCard = ({ item }) => {
  const [recs, setRecs] = useState([]);
  const [showRecs, setShowRecs] = useState(false);

  const fetchRecs = async () => {
    if(!showRecs) {
      const res = await apiClient.get(`/api/art/recommend?artwork_name=${encodeURIComponent(item.name)}`);
      setRecs(res.data);
    }
    setShowRecs(!showRecs);
  };

  return (
    <div style={{
      border:'1px solid #c9a227',
      padding:'15px',
      borderRadius:'8px',
      background:'linear-gradient(135deg, #fdfbf7 0%, #f5f0e6 100%)'
    }}>
      <h3 style={{color:'#5c4033', marginBottom:'8px'}}>{item.name}</h3>
      <p style={{fontSize:'0.9em', color:'#666'}}>
        <strong>Artist:</strong> {item.creator}
      </p>
      <p style={{fontSize:'0.85em', color:'#888'}}>
        <strong>Type:</strong> {item.type} | <strong>Movement:</strong> {item.movement}
      </p>
      <p style={{fontSize:'0.85em', color:'#888'}}>
        <strong>Country:</strong> {item.country} | <strong>Location:</strong> {item.location}
      </p>
      {item.date && item.date !== 'N/A' && (
        <p style={{fontSize:'0.8em', color:'#999'}}>
          <strong>Date:</strong> {item.date.substring(0, 4)}
        </p>
      )}
      <button
        onClick={fetchRecs}
        style={{
          cursor:'pointer',
          padding:'5px 10px',
          marginTop:'10px',
          background:'#c9a227',
          color:'white',
          border:'none',
          borderRadius:'4px'
        }}
      >
        {showRecs ? 'Hide Similar' : 'Show Similar'}
      </button>
      {showRecs && (
        <ul style={{fontSize:'0.8em', background:'#fff8e7', padding:'10px', marginTop:'10px', borderRadius:'4px'}}>
          {recs.map((r, i) => (
            <li key={i}>
              <strong>{r.name}</strong>
              <br/>
              <span style={{color:'#888'}}>{r.reason}</span>
            </li>
          ))}
          {recs.length===0 && <li>No similar artworks found.</li>}
        </ul>
      )}
    </div>
  );
};

export default ArtCard;
