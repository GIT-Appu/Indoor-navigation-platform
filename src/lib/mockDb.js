// Local-storage mock database fallback for Campus Navigator
const KEY_PREFIX = 'campus_nav_db_'

function getItems(key) {
  const data = localStorage.getItem(KEY_PREFIX + key)
  return data ? JSON.parse(data) : []
}

function saveItems(key, items) {
  localStorage.setItem(KEY_PREFIX + key, JSON.stringify(items))
}

export const mockDb = {
  campuses: {
    list: () => getItems('campuses').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    create: (campus) => {
      const list = getItems('campuses')
      const newCampus = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        created_at: new Date().toISOString(),
        ...campus
      }
      list.push(newCampus)
      saveItems('campuses', list)
      return newCampus
    },
    delete: (id) => {
      const list = getItems('campuses')
      saveItems('campuses', list.filter(item => item.id !== id))

      // Cascade delete buildings
      const buildings = getItems('buildings').filter(b => b.campus_id === id)
      buildings.forEach(b => mockDb.buildings.delete(b.id))
    }
  },
  buildings: {
    list: (campusId) => {
      const list = getItems('buildings').filter(b => b.campus_id === campusId)
      const floors = getItems('floors')
      return list.map(b => ({
        ...b,
        floors: floors.filter(f => f.building_id === b.id)
      })).sort((a, b) => a.name.localeCompare(b.name))
    },
    create: (campusId, name) => {
      const list = getItems('buildings')
      const newBuilding = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        campus_id: campusId,
        name,
        created_at: new Date().toISOString()
      }
      list.push(newBuilding)
      saveItems('buildings', list)
      return newBuilding
    },
    delete: (id) => {
      const list = getItems('buildings')
      saveItems('buildings', list.filter(item => item.id !== id))

      // Cascade delete floors
      const floors = getItems('floors').filter(f => f.building_id === id)
      floors.forEach(f => mockDb.floors.delete(f.id))
    }
  },
  floors: {
    get: (id) => {
      const list = getItems('floors')
      return list.find(f => f.id === id) || null
    },
    create: (buildingId, floor) => {
      const list = getItems('floors')
      const newFloor = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        building_id: buildingId,
        created_at: new Date().toISOString(),
        floor_plan_url: null,
        metadata: {},
        ...floor
      }
      list.push(newFloor)
      saveItems('floors', list)
      return newFloor
    },
    updatePlan: (id, url) => {
      const list = getItems('floors')
      const floorIndex = list.findIndex(f => f.id === id)
      if (floorIndex === -1) throw new Error('Floor not found')
      list[floorIndex].floor_plan_url = url
      saveItems('floors', list)
      return list[floorIndex]
    },
    update: (id, patch) => {
      const list = getItems('floors')
      const index = list.findIndex(f => f.id === id)
      if (index === -1) throw new Error('Floor not found')
      list[index] = { ...list[index], ...patch }
      saveItems('floors', list)
      return list[index]
    },
    delete: (id) => {
      const list = getItems('floors')
      saveItems('floors', list.filter(item => item.id !== id))

      // Cascade delete nodes
      const nodes = getItems('nodes').filter(n => n.floor_id === id)
      nodes.forEach(n => mockDb.nodes.delete(n.id))
    }
  },
  nodes: {
    list: (floorId) => {
      return getItems('nodes').filter(n => n.floor_id === floorId)
    },
    create: (floorId, node) => {
      const list = getItems('nodes')
      const newNode = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        floor_id: floorId,
        created_at: new Date().toISOString(),
        metadata: {},
        ...node
      }
      list.push(newNode)
      saveItems('nodes', list)
      return newNode
    },
    update: (id, patch) => {
      const list = getItems('nodes')
      const index = list.findIndex(n => n.id === id)
      if (index === -1) throw new Error('Node not found')
      list[index] = { ...list[index], ...patch }
      saveItems('nodes', list)
      return list[index]
    },
    delete: (id) => {
      const list = getItems('nodes')
      saveItems('nodes', list.filter(n => n.id !== id))

      // Cascade delete connecting edges
      const edges = getItems('edges')
      saveItems('edges', edges.filter(e => e.from_node_id !== id && e.to_node_id !== id))
    }
  },
  edges: {
    listForNodes: (nodeIds) => {
      if (nodeIds.length === 0) return []
      const set = new Set(nodeIds)
      return getItems('edges').filter(e => set.has(e.from_node_id) || set.has(e.to_node_id))
    },
    create: (fromNodeId, toNodeId, weight) => {
      const list = getItems('edges')
      const newEdge = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        weight,
        created_at: new Date().toISOString()
      }
      list.push(newEdge)
      saveItems('edges', list)
      return newEdge
    },
    delete: (id) => {
      const list = getItems('edges')
      saveItems('edges', list.filter(e => e.id !== id))
    }
  }
}
