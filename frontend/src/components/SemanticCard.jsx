import React, { useState } from 'react';
import { apiClient } from '../api/client';

const SemanticCard = ({ item }) => {
  const [recs, setRecs] = useState([]);
  const [showRecs, setShowRecs] = useState(false);

  const fetchRecs = async () => {
    if(!showRecs) {
      const res = await apiClient.get(`/api/recommend?band_name=${encodeURIComponent(item.name)}`);
      setRecs(res.data);
    }
    setShowRecs(!showRecs);
  };

  return (
    <div style={{border:'1px solid #ddd', padding:'15px', borderRadius:'8px', background:'white'}}>
      <h3>{item.name}</h3>
      <p>Genre: {item.genre} | Origin: {item.country}</p>
      <button onClick={fetchRecs} style={{cursor:'pointer', padding:'5px'}}>
        {showRecs ? 'Hide' : 'Show Similar'}
      </button>
      {showRecs && (
        <ul style={{fontSize:'0.8em', background:'#f9f9f9', padding:'10px'}}>
          {recs.map((r, i) => <li key={i}>{r.name}</li>)}
          {recs.length===0 && <li>No similar bands found locally.</li>}
        </ul>
      )}
    </div>
  );
};
export default SemanticCard;