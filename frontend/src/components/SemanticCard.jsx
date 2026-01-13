import React, { useState } from 'react';
import { apiClient } from '../api/client';

const SemanticCard = ({ item }) => {
  const [showSimilars, setShowSimilars] = useState(false);
  const [similars, setSimilars] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFetchSimilars = async () => {
    // Dacă lista e deja deschisă, o închidem (Toggle)
    if (showSimilars) {
      setShowSimilars(false);
      return;
    }

    setLoading(true);
    setShowSimilars(true);
    
    try {
      // Apelăm Gateway-ul care duce la Spark
      const res = await apiClient.get(`/api/similar?band=${item.name}`);
      setSimilars(res.data);
    } catch (err) {
      console.error("Failed to fetch similars", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      {/* --- HEADER --- */}
      <div style={styles.header}>
        <div style={styles.icon}>🎵</div>
        <div style={{ flex: 1 }}>
          <h3 style={styles.title}>{item.name}</h3>
          <span style={styles.subtitle}>
            {/* Afișăm genul sau o valoare default */}
             {item.genre ? item.genre : "Music Artist"} 
             {item.location ? ` • ${item.location}` : ""}
          </span>
        </div>
        {item.value && (
            <div style={styles.badge}>{item.value}</div>
        )}
      </div>

      {/* --- BUTTON SPARK --- */}
      <button onClick={handleFetchSimilars} style={styles.button}>
        {showSimilars ? "Hide Similars" : "⚡ Find Similar"}
      </button>

      {/* --- LISTA REZULTATE --- */}
      {showSimilars && (
        <div style={styles.similarContainer}>
          {loading ? (
            <div style={{color: '#666', fontSize: '0.85rem', padding: '5px'}}>
               Spark is processing...
            </div>
          ) : similars.length > 0 ? (
            <ul style={styles.list}>
              {similars.map((sim, idx) => (
                <li key={idx} style={styles.listItem}>
                  <span style={{ fontWeight: '600' }}>{sim.name}</span> 
                  <span style={{fontSize: '0.75rem', color: '#94a3b8', marginLeft: '6px'}}>
                    matches genre: {sim.reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '5px'}}>
              No similar bands found via Spark.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- STILURI INLINE ---
const styles = {
  card: {
    background: 'white',
    borderRadius: '10px',
    padding: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'transform 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  icon: {
    width: '42px',
    height: '42px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: 'white',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)'
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#1e293b',
    fontWeight: '700'
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    display: 'block',
    marginTop: '2px'
  },
  badge: {
      background: '#f1f5f9',
      color: '#475569',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 'bold'
  },
  button: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    alignSelf: 'flex-start',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  similarContainer: {
    marginTop: '5px',
    paddingTop: '10px',
    borderTop: '1px dashed #cbd5e1',
    animation: 'fadeIn 0.3s ease-in-out'
  },
  list: {
    paddingLeft: '0',
    listStyle: 'none',
    margin: 0
  },
  listItem: {
    fontSize: '0.9rem',
    color: '#334155',
    marginBottom: '6px',
    padding: '4px',
    background: '#fcfcfc',
    borderRadius: '4px'
  }
};

export default SemanticCard;