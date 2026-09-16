import { Node, Edge } from 'reactflow';

export interface SpatialAnalysis {
  clusters: Node[][];
  isolatedNodes: Node[];
  hubs: { node: Node; connectionCount: number }[];
  density: string;
}

export const analyzeSpatialLayout = (nodes: Node[], edges: Edge[]): SpatialAnalysis => {
  const DISTANCE_THRESHOLD = 300;
  
  // Find hubs (most connections)
  const connectionCounts: Record<string, number> = {};
  edges.forEach(edge => {
    connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
    connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
  });

  const hubs = Object.entries(connectionCounts)
    .map(([nodeId, count]) => ({
      node: nodes.find(n => n.id === nodeId)!,
      connectionCount: count
    }))
    .filter(hub => hub.node !== undefined)
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 5); // Top 5 hubs

  // Isolated nodes
  const connectedNodeIds = new Set([
    ...edges.map(e => e.source),
    ...edges.map(e => e.target)
  ]);
  const isolatedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

  // Clusters
  const clusters: Node[][] = [];
  const visited = new Set<string>();

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const cluster: Node[] = [node];
    visited.add(node.id);

    let addedToCluster = true;
    while (addedToCluster) {
      addedToCluster = false;
      
      for (const otherNode of nodes) {
        if (visited.has(otherNode.id)) continue;
        
        const isClose = cluster.some(clusterNode => {
          const dx = (clusterNode.position?.x || 0) - (otherNode.position?.x || 0);
          const dy = (clusterNode.position?.y || 0) - (otherNode.position?.y || 0);
          return Math.sqrt(dx * dx + dy * dy) <= DISTANCE_THRESHOLD;
        });

        if (isClose) {
          cluster.push(otherNode);
          visited.add(otherNode.id);
          addedToCluster = true;
        }
      }
    }
    
    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  // Density calculation
  let density = 'sparse';
  if (nodes.length > 0) {
    const area = calculateBoundingBoxArea(nodes);
    const nodesPer1000px = (nodes.length / (area || 1)) * 1000000;
    
    if (nodesPer1000px > 5) density = 'dense';
    else if (nodesPer1000px > 1) density = 'medium';
  }

  return {
    clusters,
    isolatedNodes,
    hubs,
    density
  };
};

function calculateBoundingBoxArea(nodes: Node[]): number {
  if (nodes.length === 0) return 0;
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  nodes.forEach(node => {
    const x = node.position?.x || 0;
    const y = node.position?.y || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return width * height;
}
