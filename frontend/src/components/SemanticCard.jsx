import React from 'react';

const SemanticCard = ({ item }) => {
  return (
    <div className="card-hover" style={{ 
      background: 'white', 
      borderRadius: '12px', 
      overflow: 'hidden', 
      border: '1px solid #e2e8f0',
      transition: 'transform 0.2s, box-shadow 0.2s',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* HEADER COLORAT */}
      <div style={{ 
        height: '6px', 
        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' 
      }}></div>

      <div style={{ padding: '20px' }}>
        {/* TITLU SI AN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{item.name}</h3>
          {item.year && item.year !== 'N/A' && (
            <span style={{ 
              background: '#f1f5f9', 
              color: '#64748b', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '0.75rem', 
              fontWeight: 'bold' 
            }}>
              Est. {item.year}
            </span>
          )}
        </div>

        {/* GENUL MUZICAL */}
        <div style={{ marginBottom: '15px' }}>
            <span style={{ 
              display: 'inline-block',
              background: '#eff6ff', 
              color: '#3b82f6', 
              padding: '4px 10px', 
              borderRadius: '6px', 
              fontSize: '0.85rem', 
              fontWeight: '500'
            }}>
              🎸 {item.genre || "Unknown Genre"}
            </span>
        </div>

        {/* LOCATIA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.9rem' }}>
          <span>📍</span>
          <span>{item.country || "Unknown Location"}</span>
        </div>
      </div>
      
      {/* FOOTER (ID Wikidata) */}
      <div style={{ 
        marginTop: 'auto', 
        padding: '10px 20px', 
        background: '#f8fafc', 
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.7rem',
        color: '#94a3b8',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>ID: {item.id.split('/').pop()}</span>
        <span>Source: Wikidata</span>
      </div>
    </div>
  );
};

export default SemanticCard;