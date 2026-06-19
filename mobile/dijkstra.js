export function solveDijkstra(nodes, edges, startNodeId, endNodeId) {
  // 1. Build adjacency list representation of the graph
  const graph = {};
  for (const node of nodes) {
    graph[node.id] = [];
  }

  for (const edge of edges) {
    if (graph[edge.from_node_id] && graph[edge.to_node_id]) {
      const weight = edge.weight !== undefined && edge.weight !== null ? Number(edge.weight) : 1;
      graph[edge.from_node_id].push({ targetNodeId: edge.to_node_id, weight });
      graph[edge.to_node_id].push({ targetNodeId: edge.from_node_id, weight });
    }
  }

  // 2. Initialize Dijkstra state variables
  const distances = {};
  const previous = {};
  const unvisited = new Set();

  for (const node of nodes) {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    unvisited.add(node.id);
  }

  if (distances[startNodeId] === undefined) return [];
  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    // Find unvisited node with the smallest distance
    let currentNodeId = null;
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      const dist = distances[nodeId];
      if (dist < minDistance) {
        minDistance = dist;
        currentNodeId = nodeId;
      }
    }

    if (currentNodeId === null || minDistance === Infinity) {
      break;
    }

    if (currentNodeId === endNodeId) {
      break;
    }

    unvisited.delete(currentNodeId);

    // Relax neighbors
    const neighbors = graph[currentNodeId] || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.targetNodeId)) continue;

      const alt = distances[currentNodeId] + neighbor.weight;
      if (alt < distances[neighbor.targetNodeId]) {
        distances[neighbor.targetNodeId] = alt;
        previous[neighbor.targetNodeId] = currentNodeId;
      }
    }
  }

  // 3. Reconstruct path
  const path = [];
  let current = endNodeId;
  if (previous[current] === null && current !== startNodeId) {
    return []; // No valid path
  }

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return path;
}
