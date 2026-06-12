import { supabase } from '../lib/supabaseClient'
import { isMockMode } from '../context/AuthContext'
import { mockDb } from '../lib/mockDb'

export async function getCampus(campusId) {
  if (isMockMode) {
    return mockDb.campuses.list().find((c) => c.id === campusId) || null
  }
  const { data, error } = await supabase
    .from('campuses')
    .select('*')
    .eq('id', campusId)
    .single()
  if (error) throw error
  return data
}

export async function listBuildings(campusId) {
  if (isMockMode) {
    return mockDb.buildings.list(campusId)
  }
  const { data, error } = await supabase
    .from('buildings')
    .select('*, floors(*)')
    .eq('campus_id', campusId)
    .order('name')
  if (error) throw error
  return data
}

export async function createBuilding(campusId, name) {
  if (isMockMode) {
    return mockDb.buildings.create(campusId, name)
  }
  const { data, error } = await supabase
    .from('buildings')
    .insert({ campus_id: campusId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createFloor(buildingId, { name, level }) {
  if (isMockMode) {
    return mockDb.floors.create(buildingId, { name, level })
  }
  const { data, error } = await supabase
    .from('floors')
    .insert({ building_id: buildingId, name, level })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadFloorPlan(floorId, file) {
  if (isMockMode) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const updated = mockDb.floors.updatePlan(floorId, reader.result)
          resolve(updated)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file locally'))
      reader.readAsDataURL(file)
    })
  }

  const path = `floor-${floorId}/${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage
    .from('floor-plans')
    .upload(path, file, { upsert: true })
  if (upErr) throw upErr

  const { data: pub } = supabase.storage
    .from('floor-plans')
    .getPublicUrl(path)

  const { data, error } = await supabase
    .from('floors')
    .update({ floor_plan_url: pub.publicUrl })
    .eq('id', floorId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFloor(id, patch) {
  if (isMockMode) {
    return mockDb.floors.update(id, patch)
  }
  const { data, error } = await supabase
    .from('floors')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
