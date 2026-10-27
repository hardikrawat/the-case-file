import { Node } from 'reactflow';
import { getNodeLabel } from './board-serializer';

export { getNodeLabel };

export const buildNodeMap = (nodes: Node[]): Map<string, string> => {
  const map = new Map<string, string>();
  nodes.forEach(node => {
    map.set(node.id, getNodeLabel(node));
  });
  return map;
};

export const resolveNodeReferences = (
  text: string, 
  nodeMap: Map<string, string>
): { text: string; referencedIds: string[] } => {
  const referencedIds = new Set<string>();
  const regex = /\[([^\]]+)\]/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const id = match[1];
    if (nodeMap.has(id)) {
      referencedIds.add(id);
    }
  }
  
  return { text, referencedIds: Array.from(referencedIds) };
};
