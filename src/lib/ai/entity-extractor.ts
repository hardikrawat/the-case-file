import { Node } from 'reactflow';
import { getNodeLabel } from './board-serializer';

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'date' | 'location' | 'url';
  nodeIds: string[];
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
  const locationRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Square|Manor|Museum|Estate|Park|Bridge|Station|Airport|Harbor|Bay|Beach|Hill|Mountain|Valley|River|Lake|Island|City|County|Town|Village|District|Province|Campus|Building|Tower|Center|Centre|Plaza|Hall|Hotel)\b/g;

  const getOrAddEntity = (list: ExtractedEntity[], name: string, type: ExtractedEntity['type'], nodeId: string) => {
    let entity = list.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!entity) {
      entity = { name, type, nodeIds: [] };
      list.push(entity);
    }
    if (!entity.nodeIds.includes(nodeId)) {
      entity.nodeIds.push(nodeId);
    }
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
    
    // Extract Locations
    const locationMatches = content.match(locationRegex);
    if (locationMatches) {
      locationMatches.forEach(loc => getOrAddEntity(entityMap.locations, loc, 'location', node.id));
    }
    
    if (node.type === 'article' && node.data.url) {
       getOrAddEntity(entityMap.urls, node.data.url, 'url', node.id);
    }
  });

  return entityMap;
};
