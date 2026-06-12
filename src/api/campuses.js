import { supabase } from '../lib/supabaseClient'
import { isMockMode } from '../context/AuthContext'
import { mockDb } from '../lib/mockDb'

export async function listCampuses() {
  if (isMockMode) {
    return mockDb.campuses.list()
  }
  const { data, error } = await supabase
    .from('campuses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createCampus({ name, description }) {
  if (isMockMode) {
    return mockDb.campuses.create({ name, description })
  }
  const { data, error } = await supabase
    .from('campuses')
    .insert({ name, description })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCampus(id) {
  if (isMockMode) {
    return mockDb.campuses.delete(id)
  }
  const { error } = await supabase
    .from('campuses')
    .delete()
    .eq('id', id)
  if (error) throw error
}
