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
        <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <ResultCard title={entityA} stats={data.data[entityA]} color="#3b82f6" label={mode === 'country' ? 'Top Genres' : 'Top Locations'} />
          <ResultCard title={entityB} stats={data.data[entityB]} color="#ec4899" label={mode === 'country' ? 'Top Genres' : 'Top Locations'} />
          
          <div style={{ gridColumn: 'span 2', textAlign: 'center', marginTop: '20px', color: '#64748b' }}>
            🔀 Overlap: <strong>{data.overlap}</strong> bands exist in both datasets.
          </div>
        </div>
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

      <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '1px solid #d1fae5', gridColumn: 'span 2' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#047857', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            👥 Band Composition
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <span style={{ fontSize: '0.7rem', color: '#065f46' }}>Avg. Size</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#064e3b' }}>{stats.avg_band_size} members</div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: '#065f46' }}>Largest Lineup</span>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#064e3b' }}>{stats.biggest_band}</div>
            </div>
        </div>
      </div>

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

export default SparkCompare;