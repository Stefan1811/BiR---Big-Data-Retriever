import React, { useState } from 'react';
import { apiClient } from '../api/client';

const ArtCard = ({ item }) => {
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
      console.log("Fetching similar artworks for:", item.name);
      const res = await apiClient.get(`/api/art/recommend?artwork_name=${encodeURIComponent(item.name)}`);
      console.log("Response:", res.data);
      setSimilars(res.data || []);
    } catch (err) {
      console.error("Failed to fetch similar artworks:", err);
      setSimilars([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to truncate long titles
  const truncateTitle = (title, maxLength = 50) => {
    if (!title) return 'Unknown';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  return (
    <div style={styles.card}>
      {/* --- HEADER --- */}
      <div style={styles.header}>
        <div style={styles.icon}>🎨</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={styles.title} title={item.name}>
            {truncateTitle(item.name, 45)}
          </h3>
          <span style={styles.subtitle}>
            {truncateTitle(item.creator, 30)}
            {item.date && item.date !== 'N/A' ? ` • ${item.date.substring(0, 4)}` : ""}
          </span>
        </div>
        {item.movement && (
          <div style={styles.badge} title={item.movement}>
            {truncateTitle(item.movement, 15)}
          </div>
        )}
      </div>

      {/* --- INFO SUPLIMENTARE --- */}
      <div style={styles.details}>
        {item.type && (
          <span style={styles.detailItem}>
            <strong>Type:</strong> {item.type}
          </span>
        )}
        {item.country && (
          <span style={styles.detailItem}>
            <strong>Country:</strong> {item.country}
          </span>
        )}
        {item.location && (
          <span style={styles.detailItem}>
            <strong>Location:</strong> {item.location}
          </span>
        )}
      </div>

      {/* --- BUTTON SIMILAR --- */}
      <button onClick={handleFetchSimilars} style={styles.button}>
        {showSimilars ? "Hide Similar" : "⚡ Find Similar"}
      </button>

      {/* --- LISTA REZULTATE --- */}
      {showSimilars && (
        <div style={styles.similarContainer}>
          {loading ? (
            <div style={{color: '#666', fontSize: '0.85rem', padding: '5px'}}>
              ⚡ Spark is processing...
            </div>
          ) : similars.length > 0 ? (
            <ul style={styles.list}>
              {similars.map((sim, idx) => (
                <li key={idx} style={styles.listItem}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }} title={sim.name}>
                      {truncateTitle(sim.name, 40)}
                    </span>
                    <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>
                      {sim.reason}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '5px'}}>
              No similar artworks found via Spark.
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
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    border: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    transition: 'all 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  icon: {
    width: '46px',
    height: '46px',
    background: 'linear-gradient(135deg, #0004eeff 0%, #a855f7 100%)',
    color: 'white',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.3rem',
    boxShadow: '0 4px 8px rgba(201, 162, 39, 0.25)',
    flexShrink: 0
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#0f172a',
    fontWeight: '700',
    lineHeight: '1.3',
    letterSpacing: '-0.02em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    display: 'block',
    marginTop: '4px',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  badge: {
    background: '#f1f5f9',
    color: '#475569',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  details: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    fontSize: '0.85rem'
  },
  detailItem: {
    color: '#64748b',
    padding: '4px 8px',
    background: '#f8fafc',
    borderRadius: '4px',
    fontSize: '0.8rem'
  },
  button: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
    padding: '10px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    alignSelf: 'flex-start',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.2s ease',
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

export default ArtCard;

