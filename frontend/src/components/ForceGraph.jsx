import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const ForceGraph = ({ data }) => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    // Dacă nu avem date, nu facem nimic
    if (!data || data.length === 0) return;

    const nodesSet = new Set();
    const links = [];

    data.forEach(rel => {
      // Backend-ul trimite: { band, genre, influenced_by }
      // Trebuie să ne asigurăm că avem date valide
      const source = rel.band;
      const target = rel.influenced_by;

      if (source && target) {
        nodesSet.add(source);
        nodesSet.add(target);
        links.push({ source, target });
      }
    });

    const nodes = Array.from(nodesSet).map(id => ({ 
      id, 
      val: 1, 
      name: id 
    }));

    setGraphData({ nodes, links });
  }, [data]);

  return (
    <div style={{ 
      border: '1px solid var(--border)', 
      borderRadius: '8px', 
      overflow: 'hidden', 
      background: '#f9f9f9', // Fundal deschis pt contrast bun la grafic
      height: '100%' 
    }}>
      <ForceGraph2D
        ref={fgRef}
        width={800} // Ajustează lățimea dacă vrei
        height={500}
        graphData={graphData}
        nodeLabel="name"
        nodeAutoColorBy="id"
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        onNodeClick={node => {
          fgRef.current.centerAt(node.x, node.y, 1000);
          fgRef.current.zoom(8, 2000);
        }}
      />
    </div>
  );
};

export default ForceGraph;