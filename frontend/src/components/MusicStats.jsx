import React, { useState, useEffect } from 'react';

const StatCard = ({ icon, title, value, color = '#9333ea' }) => (
  <div style={{
    background: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
    transition: 'all 0.3s',
    cursor: 'pointer'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-5px)';
    e.currentTarget.style.borderColor = color;
    e.currentTarget.style.boxShadow = `0 10px 30px ${color}30`;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.borderColor = '#e5e7eb';
    e.currentTarget.style.boxShadow = 'none';
  }}>
    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{icon}</div>
    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>
      {value}
    </div>
    <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>
      {title}
    </div>
  </div>
);

const BarChart = ({ data, color = '#9333ea', maxValue }) => {
  const max = maxValue || Math.max(...data.map(d => d.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {data.map((item, idx) => {
        const percentage = (item.count / max) * 100;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              minWidth: '140px',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#1f2937',
              textAlign: 'right'
            }}>
              {item.name}
            </div>
            <div style={{
              flex: 1,
              height: '32px',
              background: '#f3f4f6',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: `${percentage}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
                transition: 'width 0.6s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '10px',
                color: 'white',
                fontWeight: '700',
                fontSize: '0.85rem'
              }}>
                {item.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MusicStats = () => {
  const [filters, setFilters] = useState({
    genre: null,
    country: null,
    decade: null
  });

  const [availableFilters, setAvailableFilters] = useState({
    genres: [],
    countries: [],
    decades: []
  });

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('genres'); // genres, countries, decades, awards, members

  // Fetch available filters on mount
  useEffect(() => {
    fetchAvailableFilters();
    fetchStats(); // Initial fetch without filters
  }, []);

  // Fetch stats when filters change
  useEffect(() => {
    fetchStats();
  }, [filters]);

  const fetchAvailableFilters = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/stats/music/filters');
      const data = await res.json();
      setAvailableFilters(data);
    } catch (err) {
      console.error('Failed to fetch filters:', err);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.genre) params.append('genre', filters.genre);
      if (filters.country) params.append('country', filters.country);
      if (filters.decade) params.append('decade', filters.decade);
      params.append('limit', '15');

      const res = await fetch(`http://localhost:8000/api/stats/music?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch stats');
      }

      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearFilter = (filterName) => {
    setFilters(prev => ({ ...prev, [filterName]: null }));
  };

  const clearAllFilters = () => {
    setFilters({ genre: null, country: null, decade: null });
  };

  const hasActiveFilters = filters.genre || filters.country || filters.decade;

  return (
    <div className="card" style={{ padding: '40px', background: 'linear-gradient(to bottom, #fafafa 0%, #ffffff 100%)' }}>
      {/* HEADER */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h2 style={{
          margin: '0 0 12px 0',
          color: '#1f2937',
          fontSize: '2rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            📊 Interactive Music Statistics
          </span>
        </h2>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '1.05rem' }}>
          Explore music data with dynamic filtering and beautiful visualizations
        </p>
      </div>

      {/* FILTERS */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#f9fafb', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#374151' }}>🔍 Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}
            >
              Clear All
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          {/* Genre Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500', color: '#4b5563' }}>
              Genre
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={filters.genre || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value || null }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  background: 'white'
                }}
              >
                <option value="">All Genres</option>
                {availableFilters.genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
              {filters.genre && (
                <button
                  onClick={() => clearFilter('genre')}
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    padding: '0 12px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Country Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500', color: '#4b5563' }}>
              Country
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={filters.country || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value || null }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  background: 'white'
                }}
              >
                <option value="">All Countries</option>
                {availableFilters.countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              {filters.country && (
                <button
                  onClick={() => clearFilter('country')}
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    padding: '0 12px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Decade Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500', color: '#4b5563' }}>
              Decade
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={filters.decade || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, decade: e.target.value ? parseInt(e.target.value) : null }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.9rem',
                  background: 'white'
                }}
              >
                <option value="">All Decades</option>
                {availableFilters.decades.map(decade => (
                  <option key={decade} value={decade}>{decade}s</option>
                ))}
              </select>
              {filters.decade && (
                <button
                  onClick={() => clearFilter('decade')}
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    padding: '0 12px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div style={{ marginTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Active filters:</span>
            {filters.genre && (
              <span style={{
                background: '#ede9fe',
                color: '#7c3aed',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                Genre: {filters.genre}
              </span>
            )}
            {filters.country && (
              <span style={{
                background: '#dbeafe',
                color: '#2563eb',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                Country: {filters.country}
              </span>
            )}
            {filters.decade && (
              <span style={{
                background: '#fef3c7',
                color: '#d97706',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                Decade: {filters.decade}s
              </span>
            )}
          </div>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          padding: '15px',
          borderRadius: '8px',
          color: '#991b1b',
          marginBottom: '20px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          Loading statistics...
        </div>
      )}

      {/* STATS */}
      {stats && !loading && (
        <>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '40px'
          }}>
            <StatCard
              icon="🎸"
              title="Total Bands"
              value={stats.total_bands}
              color="#9333ea"
            />
            <StatCard
              icon="🎵"
              title="Unique Genres"
              value={stats.top_genres.length}
              color="#ec4899"
            />
            <StatCard
              icon="🌍"
              title="Countries"
              value={stats.top_countries.length}
              color="#3b82f6"
            />
            <StatCard
              icon="🏆"
              title="With Awards"
              value={stats.top_awarded_bands.length}
              color="#f59e0b"
            />
          </div>

          {/* TABS */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '8px',
            marginBottom: '30px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            display: 'inline-flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'genres', label: '🎸 Genres', count: stats.top_genres.length, color: '#9333ea' },
              { id: 'countries', label: '🌍 Countries', count: stats.top_countries.length, color: '#3b82f6' },
              { id: 'decades', label: '📅 Decades', count: stats.bands_per_decade.length, color: '#f59e0b' },
              { id: 'awards', label: '🏆 Awards', count: stats.top_awarded_bands.length, color: '#10b981' },
              { id: 'members', label: '👥 Members', count: stats.bands_with_most_members.length, color: '#ec4899' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  background: activeTab === tab.id
                    ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)`
                    : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#6b7280',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? '600' : '500',
                  transition: 'all 0.3s',
                  fontSize: '0.95rem',
                  boxShadow: activeTab === tab.id ? `0 4px 12px ${tab.color}40` : 'none'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                {tab.label} <span style={{
                  opacity: 0.8,
                  fontSize: '0.85rem',
                  marginLeft: '4px'
                }}>({tab.count})</span>
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            {/* GENRES TAB */}
            {activeTab === 'genres' && (
              <div>
                <h3 style={{
                  margin: '0 0 24px 0',
                  color: '#1f2937',
                  fontSize: '1.3rem',
                  fontWeight: '700'
                }}>
                  Top Music Genres
                </h3>
                <BarChart
                  data={stats.top_genres}
                  color="#9333ea"
                />
              </div>
            )}

            {/* COUNTRIES TAB */}
            {activeTab === 'countries' && (
              <div>
                <h3 style={{
                  margin: '0 0 24px 0',
                  color: '#1f2937',
                  fontSize: '1.3rem',
                  fontWeight: '700'
                }}>
                  Top Countries by Bands
                </h3>
                <BarChart
                  data={stats.top_countries}
                  color="#3b82f6"
                />
              </div>
            )}

            {/* DECADES TAB */}
            {activeTab === 'decades' && (
              <div>
                <h3 style={{
                  margin: '0 0 24px 0',
                  color: '#1f2937',
                  fontSize: '1.3rem',
                  fontWeight: '700'
                }}>
                  Bands by Decade
                </h3>
                <BarChart
                  data={stats.bands_per_decade.map(d => ({ name: d.decade, count: d.count }))}
                  color="#f59e0b"
                />
              </div>
            )}

            {/* AWARDS TAB */}
            {activeTab === 'awards' && (
              <div style={{ display: 'grid', gap: '15px' }}>
                {stats.top_awarded_bands.map((band, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '20px',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', gap: '15px', marginBottom: '12px' }}>
                      <div style={{
                        minWidth: '35px',
                        height: '35px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '1rem'
                      }}>
                        🏆
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '1.1rem' }}>{band.name}</h4>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            🎸 {band.genre}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            🌍 {band.country}
                          </span>
                        </div>
                        <div style={{
                          background: '#fef3c7',
                          color: '#d97706',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}>
                          {band.awards_count} awards
                        </div>
                      </div>
                    </div>
                    {band.awards.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '6px' }}>Awards:</div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.6' }}>
                          {band.awards.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* MEMBERS TAB */}
            {activeTab === 'members' && (
              <div style={{ display: 'grid', gap: '15px' }}>
                {stats.bands_with_most_members.map((band, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '20px',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', gap: '15px', marginBottom: '12px' }}>
                      <div style={{
                        minWidth: '35px',
                        height: '35px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '1rem'
                      }}>
                        👥
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '1.1rem' }}>{band.name}</h4>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            🎸 {band.genre}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            🌍 {band.country}
                          </span>
                        </div>
                        <div style={{
                          background: '#d1fae5',
                          color: '#059669',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}>
                          {band.members_count} members
                        </div>
                      </div>
                    </div>
                    {band.members.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '6px' }}>Members:</div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.6' }}>
                          {band.members.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MusicStats;
