import { Node, Edge } from 'reactflow';
import { clusterNodes } from './spatial-analyzer';

export const getNodeLabel = (node: Node): string => {
  switch (node.type) {
    case 'sticky':
      return node.data.label || 'Empty Sticky Note';
    case 'text':
      return node.data.label || 'Empty Text';
    case 'image':
      return node.data.caption || 'Image (No Caption)';
    case 'article':
      return node.data.title || 'Article (No Title)';
    default:
      return node.data.label || `Node ${node.id}`;
  }
};

export const serializeBoardForAI = (nodes: Node[], edges: Edge[], boardTitle: string): string => {
  let output = `# Board: ${boardTitle}\n\n`;

  output += `## Summary\n`;
  output += `- Total Nodes: ${nodes.length}\n`;
  output += `- Total Connections: ${edges.length}\n\n`;

  // Spatial Grouping (simple distance clustering)
  const clusters = clusterNodes(nodes);
  
  output += `## Clusters\n`;
  clusters.forEach((cluster, index) => {
    output += `### Cluster ${index + 1}\n`;
    cluster.forEach(node => {
      output += `- [${node.id}] (${node.type}): ${getNodeLabel(node)}\n`;
      
      // Node details
      if (node.type === 'image' && node.data.src) {
        output += `  - Source: ${node.data.src}\n`;
      }
      if (node.type === 'article' && node.data.url) {
        output += `  - URL: ${node.data.url}\n`;
        if (node.data.description) {
          output += `  - Description: ${node.data.description}\n`;
        }
      }
      if (node.type === 'sticky' && node.data.color) {
        output += `  - Color: ${node.data.color}\n`;
      }
    });
    output += '\n';
  });

  // Connections
  output += `## Connections\n`;
  if (edges.length === 0) {
    output += `No connections established yet.\n\n`;
  } else {
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      const label = edge.label || 'connects to';
      
      if (source && target) {
        output += `- [${source.id}] "${getNodeLabel(source)}" --(${label})--> [${target.id}] "${getNodeLabel(target)}"\n`;
      }
    });
    output += '\n';
  }

  // Isolated Nodes
  const connectedNodeIds = new Set([
    ...edges.map(e => e.source),
    ...edges.map(e => e.target)
  ]);
  
  const isolatedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
  if (isolatedNodes.length > 0) {
    output += `## Isolated Nodes (No connections)\n`;
    isolatedNodes.forEach(node => {
      output += `- [${node.id}] (${node.type}): ${getNodeLabel(node)}\n`;
    });
  }

  return output;
};
