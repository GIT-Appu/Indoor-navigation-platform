import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCampus, listBuildings, createBuilding, createFloor } from '../api/structure'
import { ArrowLeft, Plus, Layers, School } from 'lucide-react'

export default function CampusDetail() {
  const { campusId } = useParams()
  const [campus, setCampus] = useState(null)
  const [buildings, setBuildings] = useState([])
  const [buildingName, setBuildingName] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const c = await getCampus(campusId)
      setCampus(c)
      const b = await listBuildings(campusId)
      setBuildings(b)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [campusId])

  const addBuilding = async (e) => {
    e.preventDefault()
    if (!buildingName.trim()) return
    try {
      await createBuilding(campusId, buildingName)
      setBuildingName('')
      await load()
    } catch (err) {
      console.error(err)
      alert('Failed to add building: ' + err.message)
    }
  }

  const addFloor = async (buildingId) => {
    const name = prompt('Floor name (e.g. Ground Floor, Level 1):')
    if (!name) return
    const levelStr = prompt('Level number (0 = Ground, 1 = 1st level, -1 = Basement):', '0')
    if (levelStr === null) return
    const level = parseInt(levelStr, 10)
    try {
      await createFloor(buildingId, { name, level: isNaN(level) ? 0 : level })
      await load()
    } catch (err) {
      console.error(err)
      alert('Failed to add floor: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!campus) {
    return (
      <div>
        <Link to="/campuses" className="hint">
          <ArrowLeft size={16} /> Back to Campuses
        </Link>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Campus not found</h2>
          <p className="muted">The requested campus was not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link to="/campuses" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', marginBottom: '16px' }}>
        <ArrowLeft size={16} />
        Back to Campuses
      </Link>
      
      <h1>{campus.name}</h1>
      <p className="muted">{campus.description || 'No description'}</p>

      <form className="inline-form" onSubmit={addBuilding} style={{ marginTop: '24px', marginBottom: '32px' }}>
        <input 
          placeholder="Building name (e.g. Technology Tower)" 
          value={buildingName} 
          onChange={(e) => setBuildingName(e.target.value)} 
          required 
        />
        <button type="submit" className="primary">
          <Plus size={16} />
          Add Building
        </button>
      </form>

      <h2>Buildings & Floors</h2>
      {buildings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          marginTop: '16px'
        }}>
          <School size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p className="muted">No buildings created yet. Add a building to start designing maps.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {buildings.map((b) => (
            <div key={b.id} className="building">
              <div className="building-head">
                <h3>{b.name}</h3>
                <button onClick={() => addFloor(b.id)}>
                  <Plus size={14} /> Floor
                </button>
              </div>

              {(!b.floors || b.floors.length === 0) ? (
                <p className="muted" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}>No floors mapped to this building yet.</p>
              ) : (
                <ul className="floor-list">
                  {b.floors
                    .slice()
                    .sort((x, y) => x.level - y.level)
                    .map((f) => (
                      <li key={f.id}>
                        <Link to={`/floors/${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Layers size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>{f.name} (level {f.level})</span>
                        </Link>
                        {f.floor_plan_url ? (
                          <span className="badge ok">plan ✓</span>
                        ) : (
                          <span className="badge">no plan</span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
