import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const ForceGraph = ({ data }) => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    // Verificăm să avem date
    if (!data || data.length === 0) return;

    const nodesMap = new Map();
    const links = [];

    // Funcție ajutătoare să adăugăm noduri unice
    const addNode = (id, group) => {
      if (!nodesMap.has(id)) {
        nodesMap.set(id, { id, name: id, group });
      }
    };

    data.forEach(rel => {
      // Backend-ul trimite: { band, influenced_by, genre }
      // Verificăm dacă proprietățile există (să nu fie null)
      if (rel.band && rel.influenced_by) {
        // 1. Adăugăm Nodurile (Trupa și Influencerul)
        addNode(rel.band, rel.genre || 'Unknown');
        addNode(rel.influenced_by, 'Influencer'); // Putem marca influencerii diferit

        // 2. Adăugăm Legătura (Link)
        links.push({
          source: rel.band,
          target: rel.influenced_by
        });
      }
    });

    // Convertim Map-ul în Array pentru grafic
    const nodes = Array.from(nodesMap.values());

    setGraphData({ nodes, links });
  }, [data]);

  return (
    <div style={{ 
      border: '1px solid #e5e7eb', 
      borderRadius: '8px', 
      overflow: 'hidden', 
      background: '#f9fafb', 
      height: '500px', 
      width: '100%'
    }}>
      <ForceGraph2D
        ref={fgRef}
        width={800} 
        height={500}
        graphData={graphData}
        
        // Etichete și culori
        nodeLabel="name"
        nodeAutoColorBy="group" // Colorează în funcție de gen muzical
        
        // Săgeți pentru direcția influenței
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        
        // Fizica graficului (să nu fie prea înghesuit)
        d3VelocityDecay={0.3}
        d3AlphaDecay={0.02}
        
        onNodeClick={node => {
          fgRef.current.centerAt(node.x, node.y, 1000);
          fgRef.current.zoom(8, 2000);
        }}
      />
    </div>
  );
};

export default ForceGraph;