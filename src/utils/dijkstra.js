// Dijkstra's shortest-path over the Campus Navigator node/edge graph.
// Edges are treated as bidirectional (walkable both ways).
// Returns { path: [nodeId...], distance, order: { nodeId: index } }.
export function dijkstra(nodes, edges, startId, endId) {
  const adj = new Map()
  nodes.forEach((n) => adj.set(n.id, []))
  edges.forEach((e) => {
    const w = e.weight ?? 1
    if (adj.has(e.from_node_id)) adj.get(e.from_node_id).push([e.to_node_id, w])
    if (adj.has(e.to_node_id)) adj.get(e.to_node_id).push([e.from_node_id, w])
  })

  const dist = new Map()
  const prev = new Map()
  const visited = new Set()

  nodes.forEach((n) => dist.set(n.id, Infinity))
  dist.set(startId, 0)

  while (visited.size < nodes.length) {
    let u = null
    let best = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d
        u = id
      }
    }

    if (u === null || u === endId) break
    visited.add(u)

    for (const [v, w] of adj.get(u) ?? []) {
      if (visited.has(v)) continue
      const nd = dist.get(u) + w
      if (nd < dist.get(v)) {
        dist.set(v, nd)
        prev.set(v, u)
      }
    }
  }

  if (dist.get(endId) === Infinity) {
    return { path: [], distance: Infinity, order: {} }
  }

  const path = []
  let cur = endId
  while (cur !== undefined) {
    path.unshift(cur)
    if (cur === startId) break
    cur = prev.get(cur)
  }

  const order = {}
  path.forEach((id, i) => {
    order[id] = i
  })

  return { path, distance: dist.get(endId), order }
}
