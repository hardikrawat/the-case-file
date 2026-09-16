import { Node } from 'reactflow';
import { getNodeLabel } from './board-serializer';

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'date' | 'location' | 'url';
  nodeIds: Set<string>;
}

export interface EntityMap {
  people: ExtractedEntity[];
  dates: ExtractedEntity[];
  locations: ExtractedEntity[]; // Basic heuristic
  urls: ExtractedEntity[];
}

export const extractEntities = (nodes: Node[]): EntityMap => {
  const entityMap: EntityMap = {
    people: [],
    dates: [],
    locations: [],
    urls: []
  };

  const nameRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  const dateRegex = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
  const urlRegex = /https?:\/\/[^\s]+/g;

  const getOrAddEntity = (list: ExtractedEntity[], name: string, type: ExtractedEntity['type'], nodeId: string) => {
    let entity = list.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!entity) {
      entity = { name, type, nodeIds: new Set() };
      list.push(entity);
    }
    entity.nodeIds.add(nodeId);
  };

  nodes.forEach(node => {
    let content = getNodeLabel(node);
    
    if (node.type === 'article' && node.data.description) {
      content += ' ' + node.data.description;
    }

    // Extract People (simple capitalized words heuristic)
    const nameMatches = content.match(nameRegex);
    if (nameMatches) {
      nameMatches.forEach(name => getOrAddEntity(entityMap.people, name, 'person', node.id));
    }

    // Extract Dates
    const dateMatches = content.match(dateRegex);
    if (dateMatches) {
      dateMatches.forEach(date => getOrAddEntity(entityMap.dates, date, 'date', node.id));
    }

    // Extract URLs
    const urlMatches = content.match(urlRegex);
    if (urlMatches) {
      urlMatches.forEach(url => getOrAddEntity(entityMap.urls, url, 'url', node.id));
    }
    
    if (node.type === 'article' && node.data.url) {
       getOrAddEntity(entityMap.urls, node.data.url, 'url', node.id);
    }
  });

  return entityMap;
};
