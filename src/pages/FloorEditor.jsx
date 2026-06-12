import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getFloor, listNodes, createNode, deleteNode,
  listEdgesForNodes, createEdge, deleteEdge, updateNode
} from '../api/graph'
import { uploadFloorPlan } from '../api/structure'
import { dijkstra } from '../utils/dijkstra'
import { 
  ArrowLeft, MousePointer, PlusCircle, Link2, 
  Route, UploadCloud, ZoomIn, ZoomOut, RotateCcw, HelpCircle 
} from 'lucide-react'

const NODE_TYPES = ['room', 'corridor', 'stair', 'lift', 'entrance', 'poi']

function colorForType(type) {
  return {
    room: '#3b82f6',      // Blue
    corridor: '#6b7280',  // Gray
    stair: '#ec4899',     // Pink
    lift: '#8b5cf6',      // Purple
    entrance: '#10b981',  // Emerald
    poi: '#f59e0b',       // Amber
  }[type] || '#3b82f6'
}

export default function FloorEditor() {
  const { floorId } = useParams()
  const navigate = useNavigate()
  const svgRef = useRef(null)
  
  const [floor, setFloor] = useState(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Editor tools: select | add | connect | path
  const [tool, setTool] = useState('select')
  const [nodeType, setNodeType] = useState('room')
  
  // Interactive tool states
  const [connectFrom, setConnectFrom] = useState(null)
  const [pathFrom, setPathFrom] = useState(null)
  const [pathTo, setPathTo] = useState(null)

  // Zoom & Pan states
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Drag node state
  const [draggedNodeId, setDraggedNodeId] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const f = await getFloor(floorId)
      setFloor(f)
      const ns = await listNodes(floorId)
      setNodes(ns)
      const es = await listEdgesForNodes(ns.map((n) => n.id))
      setEdges(es)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [floorId])

  // Conversion of screen client mouse coords to the absolute 0..1000 SVG coordinates
  const toSvgCoords = (clientX, clientY) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    
    // Reverse the scale & pan transforms to locate coordinate in the local 1000x1000 viewport
    const x = Math.round(((clientX - rect.left - pan.x) / (rect.width * scale)) * 1000)
    const y = Math.round(((clientY - rect.top - pan.y) / (rect.height * scale)) * 1000)
    
    return { 
      x: Math.max(0, Math.min(1000, x)), 
      y: Math.max(0, Math.min(1000, y)) 
    }
  }

  // Handle click on canvas background (for adding nodes)
  const handleCanvasClick = async (e) => {
    if (tool !== 'add' || draggedNodeId || isPanning) return
    const rect = svgRef.current.getBoundingClientRect()
    const { x, y } = toSvgCoords(e.clientX, e.clientY)
    
    const label = prompt('Node label (e.g. Room 101, Lobby):', '')
    if (label === null) return // User cancelled prompt
    
    try {
      const node = await createNode(floorId, { type: nodeType, label: label || nodeType.toUpperCase(), x, y })
      setNodes((prev) => [...prev, node])
    } catch (err) {
      console.error(err)
      alert('Failed to create node: ' + err.message)
    }
  }

  // Click on a node handle
  const handleNodeClick = async (node, e) => {
    e.stopPropagation()
    
    if (tool === 'connect') {
      if (!connectFrom) {
        setConnectFrom(node)
        return
      }
      if (connectFrom.id === node.id) {
        setConnectFrom(null)
        return
      }
      // Add connectivity edge with weight as euclidean pixel distance
      const distance = Math.round(Math.hypot(node.x - connectFrom.x, node.y - connectFrom.y))
      try {
        const edge = await createEdge(connectFrom.id, node.id, distance)
        setEdges((prev) => [...prev, edge])
      } catch (err) {
        console.error(err)
        alert('Failed to connect nodes: ' + err.message)
      } finally {
        setConnectFrom(null)
      }
      return
    }

    if (tool === 'path') {
      if (!pathFrom) {
        setPathFrom(node)
        setPathTo(null)
        return
      }
      setPathTo(node)
    }
  }

  // Node Drag and Drop reposition handlers (Select mode)
  const handleNodeMouseDown = (node, e) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setDraggedNodeId(node.id)
  }

  // Canvas Mouse down for Panning
  const handleCanvasMouseDown = (e) => {
    if (draggedNodeId) return
    // Allow panning in any tool mode if clicking background
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (draggedNodeId) {
      // Reposition node coordinates in state dynamically as user moves mouse
      const { x, y } = toSvgCoords(e.clientX, e.clientY)
      setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x, y } : n))
      return
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }

  const handleMouseUp = async (e) => {
    if (draggedNodeId) {
      // Find final coordinates, write them down to Supabase to persist changes
      const targetNode = nodes.find(n => n.id === draggedNodeId)
      if (targetNode) {
        try {
          await updateNode(draggedNodeId, { x: targetNode.x, y: targetNode.y })
        } catch (err) {
          console.error('Failed to save node coordinates:', err)
        }
      }
      setDraggedNodeId(null)
    }
    setIsPanning(false)
  }

  const handleMouseLeave = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null)
    }
    setIsPanning(false)
  }

  // Delete actions (Right-click node or click edge in Select mode)
  const handleDeleteNode = async (node, e) => {
    e.preventDefault()
    if (!confirm(`Delete node "${node.label}"? All connecting edges will be removed.`)) return
    try {
      await deleteNode(node.id)
      setNodes((prev) => prev.filter((n) => n.id !== node.id))
      setEdges((prev) => prev.filter((x) => x.from_node_id !== node.id && x.to_node_id !== node.id))
      
      // Clean up tool anchors if deleted node was active
      if (connectFrom?.id === node.id) setConnectFrom(null)
      if (pathFrom?.id === node.id) setPathFrom(null)
      if (pathTo?.id === node.id) setPathTo(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete node: ' + err.message)
    }
  }

  const handleEdgeClick = async (edge, e) => {
    e.stopPropagation()
    if (tool !== 'select') return
    if (!confirm('Delete this walkable connection edge?')) return
    try {
      await deleteEdge(edge.id)
      setEdges((prev) => prev.filter((x) => x.id !== edge.id))
    } catch (err) {
      console.error(err)
      alert('Failed to delete edge: ' + err.message)
    }
  }

  // File plan upload
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const updated = await uploadFloorPlan(floorId, file)
      setFloor(updated)
    } catch (err) {
      console.error(err)
      alert('Failed to upload floor plan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Zoom HUD interactions
  const zoomIn = () => setScale(s => Math.min(5, s * 1.25))
  const zoomOut = () => setScale(s => Math.max(0.4, s / 1.25))
  const resetZoom = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  // Dijkstra Path Solving
  const pathResult = pathFrom && pathTo ? dijkstra(nodes, edges, pathFrom.id, pathTo.id) : null
  const pathSet = new Set(pathResult?.path ?? [])

  if (loading) {
    return (
      <div className="center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="editor">
      <div className="editor-header">
        <button onClick={() => navigate(-1)} style={{ padding: '8px 12px' }}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h2>{floor?.name} <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>(Level {floor?.level})</span></h2>
        
        <div className="toolbar">
          <button 
            className={tool === 'select' ? 'active' : ''} 
            onClick={() => { setTool('select'); setConnectFrom(null); }}
          >
            <MousePointer size={16} />
            Select / Drag
          </button>
          
          <button 
            className={tool === 'add' ? 'active' : ''} 
            onClick={() => { setTool('add'); setConnectFrom(null); }}
          >
            <PlusCircle size={16} />
            Add Node
          </button>
          
          {tool === 'add' && (
            <select value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
              {NODE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          <button 
            className={tool === 'connect' ? 'active' : ''} 
            onClick={() => { setTool('connect'); setConnectFrom(null); }}
          >
            <Link2 size={16} />
            Connect Edges
          </button>

          <button 
            className={tool === 'path' ? 'active' : ''} 
            onClick={() => { setTool('path'); setPathFrom(null); setPathTo(null); }}
          >
            <Route size={16} />
            Test Route
          </button>

          <label className="upload-btn">
            <UploadCloud size={16} />
            {uploading ? 'Uploading...' : 'Upload Plan'}
            <input type="file" accept="image/*" onChange={handleUpload} hidden disabled={uploading} />
          </label>
        </div>
      </div>

      <div 
        className="canvas-wrap"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <svg 
          ref={svgRef} 
          viewBox="0 0 1000 1000" 
          className="canvas" 
          onClick={handleCanvasClick}
        >
          {/* Main Zoomable/Pannable Layer */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            
            {/* Background Floor Plan Image */}
            {floor?.floor_plan_url && (
              <image 
                href={floor.floor_plan_url} 
                x="0" 
                y="0" 
                width="1000" 
                height="1000" 
                preserveAspectRatio="xMidYMid meet"
              />
            )}

            {/* Visual Grid Behind Map when plan missing */}
            {!floor?.floor_plan_url && (
              <rect x="0" y="0" width="1000" height="1000" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="4" />
            )}

            {/* Graph Connectivity Edges */}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from_node_id)
              const toNode = nodes.find((n) => n.id === edge.to_node_id)
              if (!fromNode || !toNode) return null
              
              // Check if edge is part of currently evaluated shortest path
              const inPath =
                pathSet.has(fromNode.id) &&
                pathSet.has(toNode.id) &&
                Math.abs(pathResult.order[fromNode.id] - pathResult.order[toNode.id]) === 1

              return (
                <line
                  key={edge.id}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={inPath ? '#f97316' : '#4b5563'}
                  strokeWidth={inPath ? 5 : 2}
                  strokeDasharray={inPath ? '8, 8' : 'none'}
                  style={inPath ? { animation: 'dash 1s linear infinite' } : {}}
                  onClick={(e) => handleEdgeClick(edge, e)}
                />
              )
            })}

            {/* Graph Node Points */}
            {nodes.map((node) => {
              const selected =
                connectFrom?.id === node.id || 
                pathFrom?.id === node.id || 
                pathTo?.id === node.id

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(e) => handleNodeClick(node, e)}
                  onMouseDown={(e) => handleNodeMouseDown(node, e)}
                  onContextMenu={(e) => handleDeleteNode(node, e)}
                  className="node-handle"
                >
                  <circle 
                    r="8" 
                    fill={colorForType(node.type)} 
                    stroke={selected ? '#ffffff' : 'rgba(0, 0, 0, 0.4)'} 
                    strokeWidth={selected ? '2.5' : '1'} 
                    style={selected ? { filter: 'drop-shadow(0 0 6px var(--primary))' } : {}}
                  />
                  <text 
                    x="12" 
                    y="4" 
                    fill="#e5e7eb"
                  >
                    {node.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Zoom & Reset HUD Panel */}
        <div className="zoom-hud">
          <button onClick={zoomIn} title="Zoom In"><ZoomIn size={16} /></button>
          <button onClick={zoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
          <button onClick={resetZoom} title="Reset"><RotateCcw size={16} /></button>
          <div className="zoom-level">{Math.round(scale * 100)}%</div>
        </div>
      </div>

      {/* Path information overlay */}
      {pathResult && (
        <div className="path-info">
          {pathResult.path.length ? (
            <span>
              Route resolved: <strong>{pathResult.distance}</strong> units across <strong>{pathResult.path.length}</strong> checkpoints.
            </span>
          ) : (
            <span>No valid walkable path found between the selected nodes.</span>
          )}
          <button onClick={() => { setPathFrom(null); setPathTo(null); }}>Clear Path</button>
        </div>
      )}

      {/* Editor Guide Legend */}
      <p className="hint">
        <HelpCircle size={14} style={{ color: 'var(--primary)' }} />
        {tool === 'select' && 'Tip: In Select tool, drag nodes to adjust positions. Right-click node to delete. Click edge line to delete.'}
        {tool === 'add' && `Tip: Click anywhere inside the layout box to place a node of type "${nodeType}".`}
        {tool === 'connect' && 'Tip: Click a starting node, then click a target node to establish a bidirectional path connection.'}
        {tool === 'path' && 'Tip: Select a starting node, then select a target node to run Dijkstra routing preview.'}
      </p>
    </div>
  )
}
