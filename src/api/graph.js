import { supabase } from '../lib/supabaseClient'
import { isMockMode } from '../context/AuthContext'
import { mockDb } from '../lib/mockDb'
import { listBuildings } from './structure'

export async function getFloor(floorId) {
  if (isMockMode) {
    return mockDb.floors.get(floorId)
  }
  const { data, error } = await supabase
    .from('floors')
    .select('*')
    .eq('id', floorId)
    .single()
  if (error) throw error
  return data
}

export async function listNodes(floorId) {
  if (isMockMode) {
    return mockDb.nodes.list(floorId)
  }
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('floor_id', floorId)
  if (error) throw error
  return data
}

export async function listCampusNodes(campusId) {
  const buildings = await listBuildings(campusId)
  const floorIds = buildings.flatMap((b) => (b.floors || []).map((f) => f.id))
  if (floorIds.length === 0) return []

  if (isMockMode) {
    const data = localStorage.getItem('campus_nav_db_nodes')
    const nodes = data ? JSON.parse(data) : []
    return nodes.filter((n) => floorIds.includes(n.floor_id))
  }

  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .in('floor_id', floorIds)
  if (error) throw error
  return data
}

export async function createNode(floorId, { type, label, x, y }) {
  if (isMockMode) {
    return mockDb.nodes.create(floorId, { type, label, x, y })
  }
  const { data, error } = await supabase
    .from('nodes')
    .insert({ floor_id: floorId, type, label, x, y })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNode(id, patch) {
  if (isMockMode) {
    return mockDb.nodes.update(id, patch)
  }
  const { data, error } = await supabase
    .from('nodes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNode(id) {
  if (isMockMode) {
    return mockDb.nodes.delete(id)
  }
  const { error } = await supabase
    .from('nodes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function listEdgesForNodes(nodeIds) {
  if (isMockMode) {
    return mockDb.edges.listForNodes(nodeIds)
  }
  if (nodeIds.length === 0) return []
  const ids = nodeIds.join(',')
  const { data, error } = await supabase
    .from('edges')
    .select('*')
    .or(`from_node_id.in.(${ids}),to_node_id.in.(${ids})`)
  if (error) throw error
  return data
}

export async function createEdge(fromNodeId, toNodeId, weight) {
  if (isMockMode) {
    return mockDb.edges.create(fromNodeId, toNodeId, weight)
  }
  const { data, error } = await supabase
    .from('edges')
    .insert({ from_node_id: fromNodeId, to_node_id: toNodeId, weight })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEdge(id) {
  if (isMockMode) {
    return mockDb.edges.delete(id)
  }
  const { error } = await supabase
    .from('edges')
    .delete()
    .eq('id', id)
  if (error) throw error
}
