import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

/**
 * NetworkGraph - Interactive visualization of relationships between artists, movements, and countries
 * Features: Click nodes for details, hover to highlight, sidebar with full info, search & filter
 */
function NetworkGraph({ artworks, title = "Art Relationships Network" }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const nodesDataSetRef = useRef(null);
  const edgesDataSetRef = useRef(null);

  // Sidebar state
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nodeDetails, setNodeDetails] = useState(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [showArtists, setShowArtists] = useState(true);
  const [showMovements, setShowMovements] = useState(true);
  const [showCountries, setShowCountries] = useState(true);

  // Search function - focus on matching node
  const searchNode = (term) => {
    if (!term || !nodesDataSetRef.current || !networkRef.current) return;

    const allNodes = nodesDataSetRef.current.get();
    const found = allNodes.find(n =>
      n.fullLabel && n.fullLabel.toLowerCase().includes(term.toLowerCase())
    );

    if (found) {
      networkRef.current.focus(found.id, {
        scale: 1.5,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
      networkRef.current.selectNodes([found.id]);

      // Also open sidebar with details
      const connectedNodeIds = networkRef.current.getConnectedNodes(found.id);
      const connectedNodes = nodesDataSetRef.current.get(connectedNodeIds);
      const nodeArtworks = artworks.filter(art => {
        if (found.group === 'artist') return art.creator === found.fullLabel;
        if (found.group === 'movement') return art.movement === found.fullLabel;
        if (found.group === 'country') return art.country === found.fullLabel;
        return false;
      });

      setNodeDetails({ ...found, connections: connectedNodes, artworks: nodeArtworks });
      setSelectedNode(found.id);
      setSidebarOpen(true);
    }
  };

  // Filter function - show/hide nodes by type
  const applyFilters = () => {
    if (!nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const allNodes = nodesDataSetRef.current.get();
    const updates = allNodes.map(node => {
      let hidden = false;
      if (node.group === 'artist' && !showArtists) hidden = true;
      if (node.group === 'movement' && !showMovements) hidden = true;
      if (node.group === 'country' && !showCountries) hidden = true;
      return { id: node.id, hidden };
    });

    nodesDataSetRef.current.update(updates);
  };

  // Apply filters when checkboxes change
  useEffect(() => {
    applyFilters();
  }, [showArtists, showMovements, showCountries]);

  // Export graph as PNG
  const exportToPNG = () => {
    if (!networkRef.current || !containerRef.current) return;

    // Get canvas from vis-network
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;

    // Create download link
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'network-graph.png';
    a.click();
  };

  useEffect(() => {
    if (!containerRef.current || !artworks || artworks.length === 0) return;

    // Build nodes and edges from artworks data
    const nodesMap = new Map();
    const edgesArray = [];
    let nodeId = 1;

    // Process artworks to create graph structure
    artworks.forEach(art => {
      const creatorName = art.creator || 'Unknown';
      const movementName = art.movement || 'Unknown';
      const countryName = art.country || 'Unknown';

      // Skip unknown values
      if (creatorName === 'Unknown' && movementName === 'Unknown') return;

      // Add creator node
      if (creatorName !== 'Unknown' && !nodesMap.has(`creator:${creatorName}`)) {
        nodesMap.set(`creator:${creatorName}`, {
          id: nodeId++,
          label: creatorName.length > 20 ? creatorName.substring(0, 20) + '...' : creatorName,
          fullLabel: creatorName,
          title: `Artist: ${creatorName}`,
          group: 'artist',
          shape: 'dot',
          size: 15,
          color: { background: '#4a90d9', border: '#2d5a87' }
        });
      }

      // Add movement node
      if (movementName !== 'Unknown' && !nodesMap.has(`movement:${movementName}`)) {
        nodesMap.set(`movement:${movementName}`, {
          id: nodeId++,
          label: movementName,
          fullLabel: movementName,
          title: `Movement: ${movementName}`,
          group: 'movement',
          shape: 'diamond',
          size: 25,
          color: { background: '#c9a227', border: '#8b6914' }
        });
      }

      // Add country node
      if (countryName !== 'Unknown' && !nodesMap.has(`country:${countryName}`)) {
        nodesMap.set(`country:${countryName}`, {
          id: nodeId++,
          label: countryName.length > 15 ? countryName.substring(0, 15) + '...' : countryName,
          fullLabel: countryName,
          title: `Country: ${countryName}`,
          group: 'country',
          shape: 'square',
          size: 20,
          color: { background: '#27ae60', border: '#1e8449' }
        });
      }

      // Create edges
      const creatorNode = nodesMap.get(`creator:${creatorName}`);
      const movementNode = nodesMap.get(`movement:${movementName}`);
      const countryNode = nodesMap.get(`country:${countryName}`);

      // Artist -> Movement
      if (creatorNode && movementNode) {
        const edgeKey = `${creatorNode.id}-${movementNode.id}`;
        if (!edgesArray.find(e => `${e.from}-${e.to}` === edgeKey)) {
          edgesArray.push({
            from: creatorNode.id,
            to: movementNode.id,
            color: { color: '#888', opacity: 0.6 },
            width: 1
          });
        }
      }

      // Artist -> Country
      if (creatorNode && countryNode) {
        const edgeKey = `${creatorNode.id}-${countryNode.id}`;
        if (!edgesArray.find(e => `${e.from}-${e.to}` === edgeKey)) {
          edgesArray.push({
            from: creatorNode.id,
            to: countryNode.id,
            color: { color: '#aaa', opacity: 0.4 },
            width: 1,
            dashes: true
          });
        }
      }
    });

    // Limit nodes for performance (max 100 nodes)
    const nodesArray = Array.from(nodesMap.values()).slice(0, 100);
    const nodeIds = new Set(nodesArray.map(n => n.id));
    const filteredEdges = edgesArray.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

    // Create DataSets
    const nodes = new DataSet(nodesArray);
    const edges = new DataSet(filteredEdges);
    nodesDataSetRef.current = nodes;
    edgesDataSetRef.current = edges;

    // Network options
    const options = {
      nodes: {
        font: {
          size: 14,
          color: '#f1f5f9',
          face: 'Arial'
        },
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.2)',
          size: 8,
          x: 2,
          y: 2
        }
      },
      edges: {
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.1)',
          size: 4
        }
      },
      physics: {
        enabled: true,
        stabilization: {
          iterations: 100
        },
        barnesHut: {
          gravitationalConstant: -3000,
          springLength: 150,
          springConstant: 0.04
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true
      },
      groups: {
        artist: {
          color: { background: '#4a90d9', border: '#2d5a87' }
        },
        movement: {
          color: { background: '#c9a227', border: '#8b6914' }
        },
        country: {
          color: { background: '#27ae60', border: '#1e8449' }
        }
      }
    };

    // Destroy previous network if exists
    if (networkRef.current) {
      networkRef.current.destroy();
    }

    // Create network
    networkRef.current = new Network(containerRef.current, { nodes, edges }, options);

    // === EVENT HANDLERS ===

    // Click event - show sidebar with details
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        const clickedNodeId = params.nodes[0];
        const nodeData = nodes.get(clickedNodeId);

        // Get connected nodes
        const connectedNodeIds = networkRef.current.getConnectedNodes(clickedNodeId);
        const connectedNodes = nodes.get(connectedNodeIds);

        // Get associated artworks
        const nodeArtworks = artworks.filter(art => {
          if (nodeData.group === 'artist') {
            return art.creator === nodeData.fullLabel;
          } else if (nodeData.group === 'movement') {
            return art.movement === nodeData.fullLabel;
          } else if (nodeData.group === 'country') {
            return art.country === nodeData.fullLabel;
          }
          return false;
        });

        setNodeDetails({
          ...nodeData,
          connections: connectedNodes,
          artworks: nodeArtworks
        });
        setSelectedNode(clickedNodeId);
        setSidebarOpen(true);
      } else {
        // Click on background → close sidebar
        setSidebarOpen(false);
        setSelectedNode(null);
      }
    });

    // Hover event - highlight node and connections
    networkRef.current.on('hoverNode', (params) => {
      const hoveredNodeId = params.node;
      const connectedNodeIds = networkRef.current.getConnectedNodes(hoveredNodeId);

      // Highlight connected nodes
      const allNodeIds = nodes.getIds();
      const updates = allNodeIds.map(id => {
        if (id === hoveredNodeId || connectedNodeIds.includes(id)) {
          return { id, opacity: 1, borderWidth: 3 };
        } else {
          return { id, opacity: 0.3 };
        }
      });
      nodes.update(updates);
    });

    // Blur event - reset all nodes
    networkRef.current.on('blurNode', () => {
      const allNodeIds = nodes.getIds();
      const updates = allNodeIds.map(id => ({ id, opacity: 1, borderWidth: 2 }));
      nodes.update(updates);
    });

    // Cleanup on unmount
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [artworks]);

  if (!artworks || artworks.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: '#f5f5f5',
        borderRadius: '8px',
        color: '#666'
      }}>
        Search for artworks to see the relationship network
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px', position: 'relative' }}>
      <h3 style={{ marginBottom: '10px' }}>{title}</h3>

      {/* Controls: Search + Filter + Legend */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '15px',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '12px 15px',
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '8px',
        border: '1px solid var(--border, #334155)'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search node..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchNode(searchTerm)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border, #334155)',
              borderRadius: '4px',
              width: '180px',
              fontSize: '13px',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f1f5f9)'
            }}
          />
          <button
            onClick={() => searchNode(searchTerm)}
            style={{
              padding: '8px 14px',
              background: '#4a90d9',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Find
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '30px', background: 'var(--border, #334155)' }}></div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary, #94a3b8)' }}>Filter:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #f1f5f9)' }}>
            <input
              type="checkbox"
              checked={showArtists}
              onChange={(e) => setShowArtists(e.target.checked)}
              style={{ accentColor: '#4a90d9' }}
            />
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#4a90d9'
            }}></span>
            Artists
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #f1f5f9)' }}>
            <input
              type="checkbox"
              checked={showMovements}
              onChange={(e) => setShowMovements(e.target.checked)}
              style={{ accentColor: '#c9a227' }}
            />
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              background: '#c9a227',
              transform: 'rotate(45deg)'
            }}></span>
            Movements
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #f1f5f9)' }}>
            <input
              type="checkbox"
              checked={showCountries}
              onChange={(e) => setShowCountries(e.target.checked)}
              style={{ accentColor: '#27ae60' }}
            />
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              background: '#27ae60'
            }}></span>
            Countries
          </label>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '30px', background: 'var(--border, #334155)' }}></div>

        {/* Export PNG */}
        <button
          onClick={exportToPNG}
          title="Download graph as PNG image"
          style={{
            padding: '8px 14px',
            background: '#9b59b6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Export PNG
        </button>
      </div>

      {/* Container for Graph + Sidebar */}
      <div style={{ position: 'relative', display: 'flex', gap: '0' }}>
        {/* Graph Container */}
        <div
          ref={containerRef}
          style={{
            width: sidebarOpen ? 'calc(100% - 380px)' : '100%',
            height: '500px',
            border: '1px solid var(--border, #334155)',
            borderRadius: '8px',
            background: '#1a2332',
            transition: 'width 0.3s ease'
          }}
        />

        {/* Sidebar */}
        {sidebarOpen && nodeDetails && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '380px',
            height: '500px',
            background: 'var(--bg-card, #1e293b)',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
            padding: '0',
            overflowY: 'auto',
            transition: 'transform 0.3s ease',
            zIndex: 10,
            borderRadius: '8px 0 0 8px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid #eee',
              background: nodeDetails.group === 'artist' ? '#4a90d9' :
                         nodeDetails.group === 'movement' ? '#c9a227' : '#27ae60',
              color: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 1
            }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>{nodeDetails.fullLabel || nodeDetails.label}</h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '0 5px',
                    lineHeight: '20px'
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{
                marginTop: '8px',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '12px',
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {nodeDetails.group}
              </div>
            </div>

            {/* Body */}
            <div style={{padding: '20px', flex: 1, overflowY: 'auto'}}>
              {/* Connections Section */}
              <div style={{marginBottom: '20px'}}>
                <h4 style={{
                  margin: '0 0 10px 0',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary, #94a3b8)',
                  borderBottom: '2px solid var(--border, #334155)',
                  paddingBottom: '8px'
                }}>
                  Connections ({nodeDetails.connections.length})
                </h4>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                  {nodeDetails.connections.map((conn, i) => (
                    <span key={i} style={{
                      padding: '6px 12px',
                      background: conn.group === 'artist' ? 'rgba(74, 144, 217, 0.2)' :
                                 conn.group === 'movement' ? 'rgba(201, 162, 39, 0.2)' : 'rgba(39, 174, 96, 0.2)',
                      color: conn.group === 'artist' ? '#4a90d9' :
                             conn.group === 'movement' ? '#c9a227' : '#27ae60',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {conn.fullLabel || conn.label}
                    </span>
                  ))}
                  {nodeDetails.connections.length === 0 && (
                    <span style={{fontSize: '12px', color: 'var(--text-secondary, #94a3b8)'}}>No connections</span>
                  )}
                </div>
              </div>

              {/* Artworks Section */}
              <div>
                <h4 style={{
                  margin: '0 0 10px 0',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary, #94a3b8)',
                  borderBottom: '2px solid var(--border, #334155)',
                  paddingBottom: '8px'
                }}>
                  Artworks ({nodeDetails.artworks.length})
                </h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {nodeDetails.artworks.slice(0, 10).map((art, i) => (
                    <div key={i} style={{
                      padding: '12px',
                      background: 'var(--bg-dark, #0f172a)',
                      borderRadius: '8px',
                      borderLeft: '3px solid ' + (nodeDetails.group === 'artist' ? '#4a90d9' :
                                                   nodeDetails.group === 'movement' ? '#c9a227' : '#27ae60')
                    }}>
                      <div style={{fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary, #f1f5f9)'}}>
                        {art.name}
                      </div>
                      <div style={{fontSize: '12px', color: 'var(--text-secondary, #94a3b8)'}}>
                        {art.creator} • {art.movement}
                      </div>
                      {art.date && art.date !== 'N/A' && (
                        <div style={{fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px'}}>
                          📅 {art.date}
                        </div>
                      )}
                      {art.location && art.location !== 'Unknown' && (
                        <div style={{fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px'}}>
                          📍 {art.location}
                        </div>
                      )}
                    </div>
                  ))}
                  {nodeDetails.artworks.length > 10 && (
                    <div style={{fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', textAlign: 'center', padding: '8px', background: 'var(--bg-dark, #0f172a)', borderRadius: '4px'}}>
                      + {nodeDetails.artworks.length - 10} more artworks
                    </div>
                  )}
                  {nodeDetails.artworks.length === 0 && (
                    <div style={{fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', textAlign: 'center', padding: '20px', background: 'var(--bg-dark, #0f172a)', borderRadius: '8px'}}>
                      No artworks found for this {nodeDetails.group}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '5px' }}>
        Showing {Math.min(artworks.length, 100)} artworks. <strong>Search</strong> to find nodes, <strong>filter</strong> by type, <strong>hover</strong> to highlight, <strong>click</strong> for details.
      </p>
    </div>
  );
}

export default NetworkGraph;
