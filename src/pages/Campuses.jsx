import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCampuses, createCampus, deleteCampus } from '../api/campuses'
import { Plus, Trash2, MapPin } from 'lucide-react'

export default function Campuses() {
  const [campuses, setCampuses] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    listCampuses()
      .then(setCampuses)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createCampus({ name, description })
      setName('')
      setDescription('')
      load()
    } catch (err) {
      console.error(err)
      alert('Failed to add campus: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this campus and all its data? This cannot be undone.')) return
    try {
      await deleteCampus(id)
      load()
    } catch (err) {
      console.error(err)
      alert('Failed to delete campus: ' + err.message)
    }
  }

  return (
    <div>
      <h1>Campuses</h1>
      <p className="muted">Add, edit, or delete campus locations below.</p>

      <form className="inline-form" onSubmit={handleCreate} style={{ marginTop: '24px' }}>
        <input 
          placeholder="Campus name (e.g. Silicon Valley Campus)" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
        />
        <input 
          placeholder="Campus Description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
        />
        <button type="submit" className="primary">
          <Plus size={16} />
          Add Campus
        </button>
      </form>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : campuses.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          marginTop: '24px'
        }}>
          <MapPin size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p className="muted">No campuses registered. Create a campus using the form above to begin.</p>
        </div>
      ) : (
        <div className="card-grid">
          {campuses.map((c) => (
            <div key={c.id} className="card">
              <div>
                <Link to={`/campuses/${c.id}`}>
                  <h3 style={{ color: '#ffffff' }}>{c.name}</h3>
                </Link>
                <p>{c.description || 'No description'}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <Link to={`/campuses/${c.id}`} style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Manage Structures &rarr;
                </Link>
                <button className="danger" onClick={() => handleDelete(c.id)} style={{ padding: '6px 12px' }}>
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
