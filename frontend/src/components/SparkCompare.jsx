import React, { useState } from 'react';
import { apiClient } from '../api/client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SparkCompare = () => {
  const [mode, setMode] = useState('country');
  const [entityA, setEntityA] = useState('United States');
  const [entityB, setEntityB] = useState('United Kingdom');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // --- FIX: Folosim ruta GATEWAY-ului (/api/compare), nu cea internă ---
      const res = await apiClient.get(`/api/compare?mode=${mode}&t1=${entityA}&t2=${entityB}`);
      
      // Verificăm dacă backend-ul a trimis o eroare logică
      if (res.data.error) {
         setError(res.data.error);
      } else {
         setData(res.data);
      }
    } catch (err) {
      console.error("Connection Error:", err);
      setError("Nu am găsit suficiente date în Fuseki sau serviciul este indisponibil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ borderTop: '4px solid #8b5cf6' }}>
      <h2 style={{ marginTop: 0, color: '#8b5cf6' }}>⚡ Advanced Analytics Engine</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Selectează dimensiunea analizei și entitățile pe care vrei să le compari folosind Apache Spark.
      </p>

      {/* --- CONTROLS --- */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          className="btn" 
          style={{ background: mode === 'country' ? '#e0e7ff' : '#f3f4f6', color: mode === 'country' ? '#4338ca' : '#333' }}
          onClick={() => { setMode('country'); setEntityA('United States'); setEntityB('United Kingdom'); }}
        >
          🌍 Compare Countries
        </button>
        <button 
          className="btn" 
          style={{ background: mode === 'genre' ? '#fce7f3' : '#f3f4f6', color: mode === 'genre' ? '#be185d' : '#333' }}
          onClick={() => { setMode('genre'); setEntityA('Rock'); setEntityB('Jazz'); }}
        >
          🎸 Compare Genres
        </button>
      </div>

      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '5px' }}>ENTITY A</label>
          <input type="text" value={entityA} onChange={(e) => setEntityA(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '10px', borderRadius: '6px' }} />
        </div>
        <span style={{ color: '#64748b', fontWeight: 'bold', fontSize: '1.2rem' }}>VS</span>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '5px' }}>ENTITY B</label>
          <input type="text" value={entityB} onChange={(e) => setEntityB(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '10px', borderRadius: '6px' }} />
        </div>
        <button onClick={handleCompare} disabled={loading} className="btn"
          style={{ height: '46px', marginTop: '22px', background: '#8b5cf6', color: 'white', fontWeight: 'bold' }}>
          {loading ? "PROCESSING..." : "RUN SPARK"}
        </button>
      </div>

      {/* --- ERROR --- */}
      {error && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* --- RESULTS --- */}
      {data && data.data && (
        <>
          <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <ResultCard title={entityA} stats={data.data[entityA]} color="#3b82f6" label={mode === 'country' ? 'Top Genres' : 'Top Locations'} />
            <ResultCard title={entityB} stats={data.data[entityB]} color="#ec4899" label={mode === 'country' ? 'Top Genres' : 'Top Locations'} />
          </div>

          {/* --- COMPARATIVE INSIGHTS --- */}
          {data.comparative_insights && (
            <ComparativeInsights insights={data.comparative_insights} entityA={entityA} entityB={entityB} mode={mode} />
          )}

         
        </>
      )}
    </div>
  );
};

const ResultCard = ({ title, stats, color, label }) => {
  if (!stats) return null; 
  return (
  <div style={{ borderTop: `4px solid ${color}`, background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', borderRadius: '6px', padding: '20px' }}>
    <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '1.5rem' }}>{title}</h3>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
      
      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Total Bands</div>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#0f172a' }}>{stats.total_bands}</div>
      </div>
      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Diversity</div>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#0f172a' }}>{stats.diversity_score}%</div>
      </div>

      <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#c2410c' }}>Avg. Founded</div>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#9a3412' }}>{stats.avg_founded_year}</div>
      </div>
      <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#c2410c' }}>Era Range</div>
        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#9a3412' }}>{stats.era_range}</div>
      </div>

      <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', gridColumn: 'span 2' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#15803d', marginBottom: '5px' }}>Most Productive Era</div>
        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#166534' }}>{stats.most_productive_decade}</div>
      </div>

      {stats.decade_breakdown && Object.keys(stats.decade_breakdown).length > 0 && (
        <div style={{ background: '#faf5ff', padding: '10px', borderRadius: '8px', border: '1px solid #e9d5ff', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7c3aed', marginBottom: '8px' }}>Timeline</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(stats.decade_breakdown).map(([decade, count]) => (
              <div key={decade} style={{
                background: 'white',
                padding: '5px 10px',
                borderRadius: '4px',
                border: '1px solid #ddd6fe',
                fontSize: '0.8rem'
              }}>
                <span style={{ fontWeight: 'bold', color: '#6b21a8' }}>{decade}</span>: {count}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>

    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>{label}:</div>
      {stats.top_distribution && stats.top_distribution.map((item, idx) => (
        <div key={idx} style={{ 
            fontSize: '0.9rem', 
            padding: '6px 0', 
            borderBottom: idx < 2 ? '1px dashed #e2e8f0' : 'none', 
            color: '#334155',
            display: 'flex',
            justifyContent: 'space-between'
        }}>
          <span>{idx + 1}. {item.split('(')[0]}</span>
          <span style={{ fontWeight: 'bold', color: color }}>{item.split('(')[1]?.replace(')', '')}</span>
        </div>
      ))}
    </div>
  </div>
)};

const ComparativeInsights = ({ insights, entityA, entityB, mode }) => {
  if (!insights || !insights.insights) return null;

  const { insights: winners, common_elements, unique_to_United_States, unique_to_United_Kingdom } = insights;

  return (
    <div style={{ marginTop: '30px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '25px', borderRadius: '12px', color: 'white' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
        🏆 Comparative Analysis
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '15px', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '5px' }}>Most Diverse</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{winners.more_diverse}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '15px', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '5px' }}>Most Prolific</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{winners.more_prolific}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '15px', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '5px' }}>Oldest Scene</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{winners.oldest_scene}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        {common_elements && common_elements.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px', opacity: 0.95 }}>
              🤝 Common {mode === 'country' ? 'Genres' : 'Locations'}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: '1.6' }}>
              {common_elements.slice(0, 5).join(', ')}
            </div>
          </div>
        )}

        {unique_to_United_States && unique_to_United_States.length > 0 && (
          <div style={{ background: 'rgba(59, 130, 246, 0.25)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px', opacity: 0.95 }}>
              🇺🇸 Unique to {entityA}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: '1.6' }}>
              {unique_to_United_States.join(', ')}
            </div>
          </div>
        )}

        {unique_to_United_Kingdom && unique_to_United_Kingdom.length > 0 && (
          <div style={{ background: 'rgba(236, 72, 153, 0.25)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px', opacity: 0.95 }}>
              🇬🇧 Unique to {entityB}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: '1.6' }}>
              {unique_to_United_Kingdom.join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SparkCompare;