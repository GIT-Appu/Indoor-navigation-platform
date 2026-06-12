import { useEffect, useRef, useState } from 'react'
import {
  listCampuses, createCampus, deleteCampus
} from '../api/campuses'
import {
  listBuildings, createBuilding, createFloor, uploadFloorPlan, updateFloor
} from '../api/structure'
import {
  listCampusNodes, listNodes, createNode, updateNode, deleteNode,
  listEdgesForNodes, createEdge, deleteEdge
} from '../api/graph'
import { supabase } from '../lib/supabaseClient'
import { isMockMode } from '../context/AuthContext'
import { dijkstra } from '../utils/dijkstra'
import {
  School, Compass, Layers, Plus, Trash2, HelpCircle, ChevronDown, ChevronUp,
  UploadCloud, ZoomIn, ZoomOut, RotateCcw, ArrowUp, ArrowLeft, ArrowRight,
  ArrowUpDown, CheckCircle, Route, Link2, PlusCircle, MousePointer, X, Sliders, Search
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

function getInstructionIcon(type) {
  switch (type) {
    case 'start':
      return <Compass size={16} style={{ color: '#10b981' }} />
    case 'floor_change':
      return <ArrowUpDown size={16} style={{ color: '#8b5cf6' }} />
    case 'left':
      return <ArrowLeft size={16} style={{ color: '#6366f1' }} />
    case 'right':
      return <ArrowRight size={16} style={{ color: '#6366f1' }} />
    case 'straight':
      return <ArrowUp size={16} style={{ color: '#9ca3af' }} />
    case 'uturn':
      return <RotateCcw size={16} style={{ color: '#f59e0b' }} />
    case 'arrive':
      return <CheckCircle size={16} style={{ color: '#10b981' }} />
    default:
      return <ArrowUp size={16} />
  }
}

export default function Dashboard() {
  const svgRef = useRef(null)

  // Data Loading states
  const [campuses, setCampuses] = useState([])
  const [buildings, setBuildings] = useState([])
  const [selectedCampusId, setSelectedCampusId] = useState('')
  const [activeFloor, setActiveFloor] = useState(null)
  
  // Floor Map Graph states
  const [nodes, setNodes] = useState([]) // current floor nodes
  const [edges, setEdges] = useState([]) // current floor edges
  
  // Campus-wide Graph states for global Dijkstra routing
  const [allCampusNodes, setAllCampusNodes] = useState([])
  const [allCampusEdges, setAllCampusEdges] = useState([])

  // Selection/Open Accordion UI states
  const [openBuildingId, setOpenBuildingId] = useState('')
  const [loadingCampuses, setLoadingCampuses] = useState(true)
  const [loadingMap, setLoadingMap] = useState(false)
  const [uploading, setUploading] = useState(false)

  // AI OCR Map Scanner state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')

  // Creation form states
  const [newCampusName, setNewCampusName] = useState('')
  const [newCampusDesc, setNewCampusDesc] = useState('')
  const [newBuildingName, setNewBuildingName] = useState('')
  const [newFloorName, setNewFloorName] = useState('')
  const [newFloorLevel, setNewFloorLevel] = useState('0')

  // Editor configuration
  const [tool, setTool] = useState('select')
  const [nodeType, setNodeType] = useState('room')

  // Interactive tool anchors
  const [connectFrom, setConnectFrom] = useState(null)
  const [pathFrom, setPathFrom] = useState(null)
  const [pathTo, setPathTo] = useState(null)
  
  // Cross-floor connection selection state
  const [targetCrossFloorNodeId, setTargetCrossFloorNodeId] = useState('')

  // Zoom & Pan states
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [draggedNodeId, setDraggedNodeId] = useState(null)

  // Progressive navigation step tracking state
  const [activeStepIndex, setActiveStepIndex] = useState(0)

  // Calibration states
  const [showCalibrationHUD, setShowCalibrationHUD] = useState(false)
  const [calibrationX, setCalibrationX] = useState(0)
  const [calibrationY, setCalibrationY] = useState(0)
  const [calibrationScale, setCalibrationScale] = useState(1)
  const [calibrationRotation, setCalibrationRotation] = useState(0)

  // Reference Overlay states
  const [refFloorId, setRefFloorId] = useState('')
  const [showRefFloorPlan, setShowRefFloorPlan] = useState(false)
  const [showRefNodes, setShowRefNodes] = useState(false)
  const [refOpacity, setRefOpacity] = useState(0.4)

  // In-app Modal System states
  const [activeModal, setActiveModal] = useState(null)
  const [modalCoords, setModalCoords] = useState({ x: 0, y: 0 })
  const [modalInputVal, setModalInputVal] = useState('')
  const [modalTarget, setModalTarget] = useState(null) // node or edge target
  const [modalError, setModalError] = useState('')

  // 1. Load initial campuses
  useEffect(() => {
    loadCampuses()
  }, [])

  const loadCampuses = async () => {
    try {
      setLoadingCampuses(true)
      const data = await listCampuses()
      setCampuses(data)
      if (data.length > 0 && !selectedCampusId) {
        setSelectedCampusId(data[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCampuses(false)
    }
  }

  // 2. Load buildings and floors when campus selection changes
  useEffect(() => {
    if (!selectedCampusId) {
      setBuildings([])
      setAllCampusNodes([])
      setAllCampusEdges([])
      setActiveFloor(null)
      return
    }
    loadCampusStructures()
  }, [selectedCampusId])

  const loadCampusStructures = async () => {
    try {
      const bList = await listBuildings(selectedCampusId)
      setBuildings(bList)
      
      const campusNodes = await listCampusNodes(selectedCampusId)
      setAllCampusNodes(campusNodes)
      const nodeIds = campusNodes.map(n => n.id)
      const campusEdges = await listEdgesForNodes(nodeIds)
      setAllCampusEdges(campusEdges)
    } catch (err) {
      console.error(err)
    }
  }

  // 3. Load active floor layout when editor floor changes
  useEffect(() => {
    if (!activeFloor) {
      setNodes([])
      setEdges([])
      return
    }
    loadFloorMap()
  }, [activeFloor])

  const loadFloorMap = async () => {
    try {
      setLoadingMap(true)
      const ns = await listNodes(activeFloor.id)
      setNodes(ns)
      const es = await listEdgesForNodes(ns.map(n => n.id))
      setEdges(es)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMap(false)
    }
  }

  // 4. Load calibration settings and auto-configure reference floor overlay
  useEffect(() => {
    if (activeFloor) {
      const cal = activeFloor.metadata?.calibration || { x_offset: 0, y_offset: 0, scale: 1, rotation: 0 }
      setCalibrationX(cal.x_offset ?? 0)
      setCalibrationY(cal.y_offset ?? 0)
      setCalibrationScale(cal.scale ?? 1)
      setCalibrationRotation(cal.rotation ?? 0)

      if (buildings.length > 0) {
        const activeB = buildings.find(b => (b.floors || []).some(f => f.id === activeFloor.id))
        if (activeB) {
          const sortedFloors = [...(activeB.floors || [])].sort((a, b) => a.level - b.level)
          const activeIdx = sortedFloors.findIndex(f => f.id === activeFloor.id)
          if (activeIdx > 0) {
            setRefFloorId(sortedFloors[activeIdx - 1].id)
            setShowRefFloorPlan(true)
            setShowRefNodes(true)
          } else {
            setRefFloorId('')
            setShowRefFloorPlan(false)
            setShowRefNodes(false)
          }
        }
      }
    }
  }, [activeFloor, buildings])

  const handleSaveCalibration = async () => {
    if (!activeFloor) return
    const prevMetadata = activeFloor.metadata || {}
    const updatedMetadata = {
      ...prevMetadata,
      calibration: {
        x_offset: calibrationX,
        y_offset: calibrationY,
        scale: calibrationScale,
        rotation: calibrationRotation
      }
    }

    try {
      const updated = await updateFloor(activeFloor.id, { metadata: updatedMetadata })
      setActiveFloor(updated)
      
      setBuildings(prev => prev.map(b => ({
        ...b,
        floors: (b.floors || []).map(f => f.id === updated.id ? updated : f)
      })))
      
      alert('Floor plan alignment saved successfully!')
    } catch (err) {
      alert('Failed to save floor alignment: ' + err.message)
    }
  }

  const handleResetCalibration = () => {
    setCalibrationX(0)
    setCalibrationY(0)
    setCalibrationScale(1)
    setCalibrationRotation(0)
  }

  // Auto-center the SVG canvas viewport on a specific node coordinates
  const centerOnNode = (node) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const centeredPanX = (rect.width / 2) - ((node.x / 1000) * rect.width * scale)
    const shadowPanY = (rect.height / 2) - ((node.y / 1000) * rect.height * scale)
    setPan({ x: centeredPanX, y: shadowPanY })
  }

  // Creation handles
  const handleCreateCampus = async (e) => {
    e.preventDefault()
    if (!newCampusName.trim()) return
    try {
      const result = await createCampus({ name: newCampusName, description: newCampusDesc })
      setNewCampusName('')
      setNewCampusDesc('')
      await loadCampuses()
      setSelectedCampusId(result.id)
    } catch (err) {
      alert('Failed to add campus: ' + err.message)
    }
  }

  const handleCreateBuilding = async (e) => {
    e.preventDefault()
    if (!newBuildingName.trim() || !selectedCampusId) return
    try {
      await createBuilding(selectedCampusId, newBuildingName)
      setNewBuildingName('')
      await loadCampusStructures()
    } catch (err) {
      alert('Failed to add building: ' + err.message)
    }
  }

  const handleCreateFloor = async (buildingId, e) => {
    e.preventDefault()
    if (!newFloorName.trim()) return
    const levelVal = parseInt(newFloorLevel, 10)
    try {
      const result = await createFloor(buildingId, { 
        name: newFloorName, 
        level: isNaN(levelVal) ? 0 : levelVal 
      })
      setNewFloorName('')
      setNewFloorLevel('0')
      await loadCampusStructures()
      setActiveFloor(result)
    } catch (err) {
      alert('Failed to add floor: ' + err.message)
    }
  }

  // Map canvas calculation logic
  const toSvgCoords = (clientX, clientY) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.round(((clientX - rect.left - pan.x) / (rect.width * scale)) * 1000)
    const y = Math.round(((clientY - rect.top - pan.y) / (rect.height * scale)) * 1000)
    return {
      x: Math.max(0, Math.min(1000, x)),
      y: Math.max(0, Math.min(1000, y))
    }
  }

  const handleCanvasClick = (e) => {
    if (tool !== 'add' || draggedNodeId || isPanning || !activeFloor) return
    const { x, y } = toSvgCoords(e.clientX, e.clientY)
    
    setModalCoords({ x, y })
    setModalInputVal('')
    setModalError('')
    setActiveModal('add_node')
  }

  const submitAddNode = async () => {
    const label = modalInputVal.trim()
    if (!label) {
      setModalError('Label name is required.')
      return
    }
    try {
      const node = await createNode(activeFloor.id, { 
        type: nodeType, 
        label, 
        x: modalCoords.x, 
        y: modalCoords.y 
      })
      setNodes(prev => [...prev, node])
      setAllCampusNodes(prev => [...prev, node])
      setActiveModal(null)
    } catch (err) {
      setModalError('Failed: ' + err.message)
    }
  }

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
      const dist = Math.max(1, Math.round(Math.hypot(node.x - connectFrom.x, node.y - connectFrom.y) * 0.08))
      try {
        const edge = await createEdge(connectFrom.id, node.id, dist)
        setEdges(prev => [...prev, edge])
        setAllCampusEdges(prev => [...prev, edge])
      } catch (err) {
        alert('Failed to connect: ' + err.message)
      } finally {
        setConnectFrom(null)
      }
      return
    }

    if (tool === 'path') {
      if (!pathFrom) {
        setPathFrom(node)
        setPathTo(null)
        setActiveStepIndex(0)
        return
      }
      setPathTo(node)
    }
  }

  // Cross-floor connectivity creation
  const handleCreateCrossFloorLink = async () => {
    if (!connectFrom || !targetCrossFloorNodeId) return
    try {
      const edge = await createEdge(connectFrom.id, targetCrossFloorNodeId, 80) // 80 standard travel weight
      setEdges(prev => [...prev, edge])
      setAllCampusEdges(prev => [...prev, edge])
      setTargetCrossFloorNodeId('')
      setConnectFrom(null)
      alert('Cross-floor route connection established!')
    } catch (err) {
      alert('Failed to build link: ' + err.message)
    }
  }

  // Custom modal deletes & weight adjustments
  const triggerDeleteNodeModal = (node, e) => {
    e.preventDefault()
    e.stopPropagation()
    setModalTarget(node)
    setModalError('')
    setActiveModal('delete_node')
  }

  const submitDeleteNode = async () => {
    if (!modalTarget) return
    try {
      await deleteNode(modalTarget.id)
      setNodes(prev => prev.filter(n => n.id !== modalTarget.id))
      setEdges(prev => prev.filter(x => x.from_node_id !== modalTarget.id && x.to_node_id !== modalTarget.id))
      setAllCampusNodes(prev => prev.filter(n => n.id !== modalTarget.id))
      setAllCampusEdges(prev => prev.filter(x => x.from_node_id !== modalTarget.id && x.to_node_id !== modalTarget.id))
      
      if (connectFrom?.id === modalTarget.id) setConnectFrom(null)
      if (pathFrom?.id === modalTarget.id) setPathFrom(null)
      if (pathTo?.id === modalTarget.id) setPathTo(null)
      setActiveModal(null)
    } catch (err) {
      setModalError('Failed: ' + err.message)
    }
  }

  const triggerEdgeModal = (edge, e) => {
    e.stopPropagation()
    if (tool !== 'select') return
    setModalTarget(edge)
    setModalInputVal(edge.weight.toString())
    setModalError('')
    setActiveModal('edit_edge')
  }

  const submitEditEdge = async () => {
    if (!modalTarget) return
    const newWeight = parseFloat(modalInputVal)
    if (isNaN(newWeight) || newWeight <= 0) {
      setModalError('Please enter a valid weight number.')
      return
    }
    try {
      if (isMockMode) {
        const list = JSON.parse(localStorage.getItem('campus_nav_db_edges') || '[]')
        const idx = list.findIndex(item => item.id === modalTarget.id)
        if (idx !== -1) {
          list[idx].weight = newWeight
          localStorage.setItem('campus_nav_db_edges', JSON.stringify(list))
        }
      } else {
        const { error } = await supabase.from('edges').update({ weight: newWeight }).eq('id', modalTarget.id)
        if (error) throw error
      }
      
      setEdges(prev => prev.map(x => x.id === modalTarget.id ? { ...x, weight: newWeight } : x))
      setAllCampusEdges(prev => prev.map(x => x.id === modalTarget.id ? { ...x, weight: newWeight } : x))
      setActiveModal(null)
    } catch (err) {
      setModalError('Failed: ' + err.message)
    }
  }

  const submitDeleteEdge = async () => {
    if (!modalTarget) return
    try {
      await deleteEdge(modalTarget.id)
      setEdges(prev => prev.filter(x => x.id !== modalTarget.id))
      setAllCampusEdges(prev => prev.filter(x => x.id !== modalTarget.id))
      setActiveModal(null)
    } catch (err) {
      setModalError('Failed: ' + err.message)
    }
  }

  const triggerDeleteCampusModal = () => {
    const activeCampus = campuses.find(c => c.id === selectedCampusId)
    if (!activeCampus) return
    setModalTarget(activeCampus)
    setModalError('')
    setActiveModal('delete_campus')
  }

  const submitDeleteCampus = async () => {
    if (!modalTarget) return
    try {
      await deleteCampus(selectedCampusId)
      setSelectedCampusId('')
      setActiveFloor(null)
      setPathFrom(null)
      setPathTo(null)
      await loadCampuses()
      setActiveModal(null)
    } catch (err) {
      setModalError('Failed: ' + err.message)
    }
  }

  // File plan upload
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeFloor) return
    try {
      setUploading(true)
      const updated = await uploadFloorPlan(activeFloor.id, file)
      setActiveFloor(updated)
      setBuildings(prev => prev.map(b => ({
        ...b,
        floors: b.floors.map(f => f.id === updated.id ? updated : f)
      })))
    } catch (err) {
      alert('Failed to upload plan: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // AI OCR Map blueprints auto-scanner algorithm!
  const handleAutoDetectRooms = async () => {
    if (!activeFloor?.floor_plan_url) return
    if (!window.Tesseract) {
      alert('AI OCR scanning library is still initializing. Please wait a moment.')
      return
    }

    setScanning(true)
    setScanProgress('Loading blueprint details...')

    try {
      setScanProgress('Clearing existing layout database entries...')
      const existingNodes = await listNodes(activeFloor.id)
      for (const n of existingNodes) {
        await deleteNode(n.id)
      }
      setNodes([])
      setEdges([])

      const img = new Image()
      img.src = activeFloor.floor_plan_url
      await new Promise((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Blueprint failed to load for scanning.'))
      })
      
      const origWidth = img.naturalWidth || 1000
      const origHeight = img.naturalHeight || 1000

      setScanProgress('Initializing OCR engine worker...')

      const result = await window.Tesseract.recognize(
        activeFloor.floor_plan_url,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing') {
              setScanProgress(`Analyzing text elements... ${Math.round(m.progress * 100)}%`)
            } else {
              setScanProgress(`Worker: ${m.status}`)
            }
          }
        }
      )

      const words = result.data.words || []
      
      const cleanWords = words.filter(w => {
        const txt = w.text.trim()
        if (w.confidence < 45 || txt.length === 0) return false
        
        const cleanedText = txt.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
        const lower = cleanedText.toLowerCase()

        if (lower.length === 0) return false
        if (lower.length === 1 && !lower.match(/[a-z0-9]/i)) return false

        const wordY = (w.bbox.y0 + w.bbox.y1) / 2
        const relY = wordY / origHeight
        if (relY < 0.13) return false

        if (lower.match(/^\d+\.\d+(m|cm)?$/)) return false;
        if (lower.match(/^\d+(\.\d+)?(m|cm)?x\d+(\.\d+)?(m|cm)?$/)) return false;
        if (lower.match(/^\d+(m|cm)$/)) return false;
        if (lower.match(/^x\d+(\.\d+)?(m|cm)?$/)) return false;

        const scaleWords = ['scale', 'legend', 'drawing', 'plan', 'blueprint', 'structure', '1cm', '2m', '4m', '6m', '8m', '10m', '1cm=2m', '1cm='];
        if (scaleWords.some(term => lower.includes(term))) return false;

        if (lower.match(/^[_\-=+*|\\/()\[\]{}&^%$#@!~`?.;:]+$/)) return false;

        return true
      })

      const shouldGroup = (w1, w2) => {
        const h1 = w1.bbox.y1 - w1.bbox.y0
        const h2 = w2.bbox.y1 - w2.bbox.y0
        const avgHeight = (h1 + h2) / 2
        
        const w1Width = w1.bbox.x1 - w1.bbox.x0
        const w2Width = w2.bbox.x1 - w2.bbox.x0

        const xOverlap = Math.max(0, Math.min(w1.bbox.x1, w2.bbox.x1) - Math.max(w1.bbox.x0, w2.bbox.x0))
        const yOverlap = Math.max(0, Math.min(w1.bbox.y1, w2.bbox.y1) - Math.max(w1.bbox.y0, w2.bbox.y0))

        if (yOverlap > avgHeight * 0.3) {
          const hGap = Math.min(
            Math.abs(w1.bbox.x0 - w2.bbox.x1),
            Math.abs(w2.bbox.x0 - w1.bbox.x1)
          )
          if (hGap < avgHeight * 1.5) return true
        }

        if (xOverlap > Math.min(w1Width, w2Width) * 0.15) {
          const vGap = Math.min(
            Math.abs(w1.bbox.y0 - w2.bbox.y1),
            Math.abs(w2.bbox.y0 - w1.bbox.y1)
          )
          if (vGap < avgHeight * 1.5) return true
        }

        return false
      }

      const parent = Array.from({ length: cleanWords.length }, (_, i) => i)
      const find = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]]
          i = parent[i]
        }
        return i
      }
      const union = (i, j) => {
        const rootI = find(i)
        const rootJ = find(j)
        if (rootI !== rootJ) {
          parent[rootI] = rootJ
        }
      }

      for (let i = 0; i < cleanWords.length; i++) {
        for (let j = i + 1; j < cleanWords.length; j++) {
          if (shouldGroup(cleanWords[i], cleanWords[j])) {
            union(i, j)
          }
        }
      }

      const clusters = new Map()
      for (let i = 0; i < cleanWords.length; i++) {
        const root = find(i)
        if (!clusters.has(root)) {
          clusters.set(root, [])
        }
        clusters.get(root).push(cleanWords[i])
      }

      const roomNodes = []
      const connectionNodes = []

      for (const [_, clusterWords] of clusters) {
        clusterWords.sort((a, b) => {
          const yDiff = Math.abs(a.bbox.y0 - b.bbox.y0)
          const avgHeight = ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) / 2
          if (yDiff < avgHeight * 0.4) {
            return a.bbox.x0 - b.bbox.x0
          }
          return a.bbox.y0 - b.bbox.y0
        })

        const cleanedWordsList = clusterWords
          .map(w => {
            return w.text.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
          })
          .filter(Boolean)

        const uniqueWords = []
        for (const w of cleanedWordsList) {
          if (uniqueWords.length === 0 || uniqueWords[uniqueWords.length - 1].toLowerCase() !== w.toLowerCase()) {
            uniqueWords.push(w)
          }
        }

        if (uniqueWords.length === 0) continue

        const rawText = uniqueWords.join(' ')
        if (rawText.length < 2) continue

        const toTitleCase = (str) => {
          return str
            .toLowerCase()
            .split(/\s+/)
            .map(word => {
              if (!word) return ''
              if (word.match(/^\d+[a-z]?$/i) || word.length === 1) {
                return word.toUpperCase()
              }
              if (['wc', 'poi', 'ee'].includes(word)) {
                return word.toUpperCase()
              }
              return word.charAt(0).toUpperCase() + word.slice(1)
            })
            .join(' ')
        }

        const cleanLabel = toTitleCase(rawText)

        const bbox = {
          x0: Math.min(...clusterWords.map(w => w.bbox.x0)),
          y0: Math.min(...clusterWords.map(w => w.bbox.y0)),
          x1: Math.max(...clusterWords.map(w => w.bbox.x1)),
          y1: Math.max(...clusterWords.map(w => w.bbox.y1))
        }

        const x_img = (bbox.x0 + bbox.x1) / 2
        const y_img = (bbox.y0 + bbox.y1) / 2

        const x = Math.round((x_img / origWidth) * 1000)
        const y = Math.round((y_img / origHeight) * 1000)

        const lower = cleanLabel.toLowerCase()
        let type = 'room'
        if (lower.includes('stair') || lower.includes('step') || lower.includes('escalator')) {
          type = 'stair'
        } else if (lower.includes('lift') || lower.includes('elevator')) {
          type = 'lift'
        } else if (lower.includes('entrance') || lower.includes('lobby') || lower.includes('exit') || lower.includes('reception') || lower.includes('gate') || lower.includes('entry')) {
          type = 'entrance'
        } else if (lower.includes('corridor') || lower.includes('hall') || lower.includes('walkway') || lower.includes('passage') || lower.includes('circulation')) {
          type = 'corridor'
        } else if (lower.includes('toilet') || lower.includes('washroom') || lower.includes('wc') || lower.includes('restroom') || lower.includes('pantry') || lower.includes('kitchen') || lower.includes('lounge') || lower.includes('janitor')) {
          type = 'poi'
        }

        const node = await createNode(activeFloor.id, { type, label: cleanLabel, x, y })
        if (type === 'room' || type === 'poi') {
          roomNodes.push(node)
        } else {
          connectionNodes.push(node)
        }
      }

      if (roomNodes.length === 0 && connectionNodes.length === 0) {
        alert('OCR finished scanning, but could not detect any room text with high confidence.')
      } else {
        setScanProgress('Building walkable hallway connection graph...')
        
        const autoEdges = []
        const corridorNodes = []

        const TOP_CORRIDOR_Y = 480
        const BTM_CORRIDOR_Y = 620

        for (const room of roomNodes) {
          const targetY = room.y < 520 ? TOP_CORRIDOR_Y : BTM_CORRIDOR_Y
          
          let corrNode = corridorNodes.find(c => c.y === targetY && Math.abs(c.x - room.x) < 40)
          
          if (!corrNode) {
            corrNode = await createNode(activeFloor.id, {
              type: 'corridor',
              label: `Hallway Near ${room.label}`,
              x: room.x,
              y: targetY
            })
            corridorNodes.push(corrNode)
          }

          const dist = Math.max(1, Math.round(Math.abs(room.y - targetY) * 0.08))
          const edge = await createEdge(room.id, corrNode.id, dist)
          autoEdges.push(edge)
        }

        const topHalls = corridorNodes.filter(c => c.y === TOP_CORRIDOR_Y).sort((a, b) => a.x - b.x)
        const btmHalls = corridorNodes.filter(c => c.y === BTM_CORRIDOR_Y).sort((a, b) => a.x - b.x)

        for (let i = 0; i < topHalls.length - 1; i++) {
          const n1 = topHalls[i]
          const n2 = topHalls[i+1]
          const dist = Math.max(1, Math.round((n2.x - n1.x) * 0.08))
          const edge = await createEdge(n1.id, n2.id, dist)
          autoEdges.push(edge)
        }

        for (let i = 0; i < btmHalls.length - 1; i++) {
          const n1 = btmHalls[i]
          const n2 = btmHalls[i+1]
          const dist = Math.max(1, Math.round((n2.x - n1.x) * 0.08))
          const edge = await createEdge(n1.id, n2.id, dist)
          autoEdges.push(edge)
        }

        if (topHalls.length > 0 && btmHalls.length > 0) {
          const leftTop = topHalls[0]
          const leftBtm = btmHalls[0]
          const leftDist = Math.max(1, Math.round(Math.abs(leftBtm.y - leftTop.y) * 0.08))
          const leftEdge = await createEdge(leftTop.id, leftBtm.id, leftDist)
          autoEdges.push(leftEdge)

          const rightTop = topHalls[topHalls.length - 1]
          const rightBtm = btmHalls[btmHalls.length - 1]
          const rightDist = Math.max(1, Math.round(Math.abs(rightBtm.y - rightTop.y) * 0.08))
          const rightEdge = await createEdge(rightTop.id, rightBtm.id, rightDist)
          autoEdges.push(rightEdge)
        }

        const allHalls = [...topHalls, ...btmHalls]
        if (allHalls.length > 0) {
          for (const conn of connectionNodes) {
            let nearestHall = null
            let minDist = Infinity
            for (const hall of allHalls) {
              const d = Math.hypot(hall.x - conn.x, hall.y - conn.y)
              if (d < minDist) {
                minDist = d
                nearestHall = hall
              }
            }
            if (nearestHall) {
              const distMeters = Math.max(1, Math.round(minDist * 0.08))
              const edge = await createEdge(conn.id, nearestHall.id, distMeters)
              autoEdges.push(edge)
            }
          }
        }

        const finalNodesList = [...roomNodes, ...connectionNodes, ...corridorNodes]
        setNodes(finalNodesList)
        setEdges(autoEdges)

        setAllCampusNodes(prev => {
          const filtered = prev.filter(n => n.floor_id !== activeFloor.id)
          return [...filtered, ...finalNodesList]
        })
        setAllCampusEdges(prev => {
          const nodeIds = new Set(finalNodesList.map(n => n.id))
          const filtered = prev.filter(e => !nodeIds.has(e.from_node_id) && !nodeIds.has(e.to_node_id))
          return [...filtered, ...autoEdges]
        })

        alert(`OCR Scan complete! Generated ${roomNodes.length} rooms, ${connectionNodes.length} connections, ${corridorNodes.length} hallway intersection nodes, and automatically linked ${autoEdges.length} routing edges. The graph is fully connected and walkable!`)
      }
    } catch (err) {
      alert('Scanning failed: ' + err.message)
    } finally {
      setScanning(false)
      setScanProgress('')
    }
  }

  // Dragging reposition handlers
  const handleNodeMouseDown = (node, e) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setDraggedNodeId(node.id)
  }

  const handleCanvasMouseDown = (e) => {
    if (draggedNodeId) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (draggedNodeId) {
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

  const handleMouseUp = async () => {
    if (draggedNodeId) {
      const targetNode = nodes.find(n => n.id === draggedNodeId)
      if (targetNode) {
        try {
          await updateNode(draggedNodeId, { x: targetNode.x, y: targetNode.y })
          setAllCampusNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x: targetNode.x, y: targetNode.y } : n))
        } catch (err) {
          console.error(err)
        }
      }
      setDraggedNodeId(null)
    }
    setIsPanning(false)
  }

  const handleMouseLeave = () => {
    if (draggedNodeId) setDraggedNodeId(null)
    setIsPanning(false)
  }

  // HUD zoom
  const zoomIn = () => setScale(s => Math.min(5, s * 1.25))
  const zoomOut = () => setScale(s => Math.max(0.4, s / 1.25))
  const resetZoom = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  // Dijkstra Solver
  const pathResult = pathFrom && pathTo ? dijkstra(allCampusNodes, allCampusEdges, pathFrom.id, pathTo.id) : null
  const pathSet = new Set(pathResult?.path ?? [])

  // Instruction Builder
  const routeInstructions = pathResult ? generateInstructions(pathResult.path, allCampusNodes) : []

  function generateInstructions(path, nodesData) {
    if (!path || path.length < 2) return []
    const steps = []
    const nodeMap = new Map(nodesData.map(n => [n.id, n]))
    const getDist = (n1, n2) => {
      const edge = allCampusEdges.find(e => 
        (e.from_node_id === n1.id && e.to_node_id === n2.id) ||
        (e.from_node_id === n2.id && e.to_node_id === n1.id)
      )
      if (edge) return Math.round(edge.weight)
      return Math.max(1, Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y) * 0.08))
    }

    for (let i = 0; i < path.length; i++) {
      const curId = path[i]
      const cur = nodeMap.get(curId)
      if (!cur) continue

      if (i === 0) {
        steps.push({
          type: 'start',
          text: `Start navigation at ${cur.label || 'Node'} (${cur.type.toUpperCase()})`,
          floorId: cur.floor_id,
          nodeId: cur.id
        })
        continue
      }

      const prevId = path[i - 1]
      const prev = nodeMap.get(prevId)
      const dist = getDist(prev, cur)

      let type = 'straight'
      let text = `Walk straight ${dist}m to ${cur.label}`

      if (i > 1) {
        const prevPrevId = path[i - 2]
        const prevPrev = nodeMap.get(prevPrevId)
        if (prevPrev && prevPrev.floor_id === prev.floor_id) {
          const dx1 = prev.x - prevPrev.x
          const dy1 = prev.y - prevPrev.y
          const dx2 = cur.x - prev.x
          const dy2 = cur.y - prev.y

          const angle1 = Math.atan2(dy1, dx1)
          const angle2 = Math.atan2(dy2, dx2)
          let diff = angle2 - angle1

          while (diff < -Math.PI) diff += 2 * Math.PI
          while (diff > Math.PI) diff -= 2 * Math.PI

          if (diff > 0.4 && diff < 2.2) {
            type = 'right'
            text = `Turn right and walk ${dist}m to ${cur.label}`
          } else if (diff < -0.4 && diff > -2.2) {
            type = 'left'
            text = `Turn left and walk ${dist}m to ${cur.label}`
          } else if (Math.abs(diff) >= 2.2) {
            type = 'uturn'
            text = `Make a U-turn and walk ${dist}m to ${cur.label}`
          }
        }
      }

      steps.push({
        type,
        text,
        floorId: cur.floor_id,
        nodeId: cur.id
      })
    }

    const lastNode = nodeMap.get(path[path.length - 1])
    steps.push({
      type: 'arrive',
      text: `Arrive at destination: ${lastNode?.label || 'Target'}`,
      floorId: lastNode?.floor_id,
      nodeId: lastNode?.id
    })

    return steps
  }

  const crossFloorOptions = connectFrom && (connectFrom.type === 'stair' || connectFrom.type === 'lift')
    ? allCampusNodes
        .filter(n => n.id !== connectFrom.id && n.floor_id !== activeFloor?.id && (n.type === 'stair' || n.type === 'lift'))
        .map(n => {
          const dist = Math.hypot(n.x - connectFrom.x, n.y - connectFrom.y)
          return { ...n, distanceToSource: dist, isAligned: dist <= 30 }
        })
        .sort((a, b) => {
          if (a.isAligned && !b.isAligned) return -1
          if (!a.isAligned && b.isAligned) return 1
          return a.distanceToSource - b.distanceToSource
        })
    : []

  const activeStepNodeId = routeInstructions[activeStepIndex]?.nodeId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {activeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 16, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '28px',
            width: '90%',
            maxWidth: '380px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative'
          }}>
            <button 
              onClick={() => setActiveModal(null)} 
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                padding: '4px',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={18} />
            </button>

            {activeModal === 'add_node' && (
              <>
                <h3 style={{ fontSize: '1.25rem' }}>Add Node</h3>
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  Label this pin dropped at coordinates ({modalCoords.x}, {modalCoords.y}).
                </p>
                <input 
                  placeholder="e.g. Reception Desk" 
                  value={modalInputVal}
                  onChange={e => setModalInputVal(e.target.value)}
                  style={{ width: '100%' }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && submitAddNode()}
                />
                {modalError && <div className="error">{modalError}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="primary" onClick={submitAddNode}>Add Pin</button>
                </div>
              </>
            )}

            {activeModal === 'edit_edge' && modalTarget && (
              <>
                <h3 style={{ fontSize: '1.25rem' }}>Modify Path</h3>
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  Adjust real-world distance (meters) or remove connection.
                </p>
                <input 
                  type="number"
                  placeholder="Distance (m)" 
                  value={modalInputVal}
                  onChange={e => setModalInputVal(e.target.value)}
                  style={{ width: '100%' }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && submitEditEdge()}
                />
                {modalError && <div className="error">{modalError}</div>}
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
                    <button className="danger" onClick={submitDeleteEdge} style={{ flex: 1, justifyContent: 'center' }}>
                      Remove Path
                    </button>
                    <button className="primary" onClick={submitEditEdge} style={{ flex: 1, justifyContent: 'center' }}>
                      Save
                    </button>
                  </div>
                  <button onClick={() => setActiveModal(null)} style={{ justifyContent: 'center' }}>Cancel</button>
                </div>
              </>
            )}

            {activeModal === 'delete_node' && modalTarget && (
              <>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--danger)' }}>Delete Node?</h3>
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  Are you sure you want to delete node <strong>{modalTarget.label}</strong>? This will remove all its path connections.
                </p>
                {modalError && <div className="error">{modalError}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="danger" onClick={submitDeleteNode}>Delete Pin</button>
                </div>
              </>
            )}

            {activeModal === 'delete_campus' && modalTarget && (
              <>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--danger)' }}>Delete Campus?</h3>
                <p className="muted" style={{ fontSize: '0.8125rem' }}>
                  Are you sure you want to delete campus <strong>{modalTarget.name}</strong> and all its buildings, floors, nodes, and edges? This action cannot be undone.
                </p>
                {modalError && <div className="error">{modalError}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="danger" onClick={submitDeleteCampus}>Delete All Data</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1>Indoor Map Studio</h1>
          <p className="muted">Unified map builder & turn-by-turn indoor route compiler.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="badge ok">Offline Simulator Active</div>
          <div className="badge">Total Campuses: {campuses.length}</div>
        </div>
      </div>

      <div className="studio-container">
        
        <aside className="studio-sidebar">
          
          <div className="sidebar-section">
            <h3>Select Campus</h3>
            {loadingCampuses ? (
              <p className="muted">Loading campuses...</p>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={selectedCampusId} 
                  onChange={(e) => {
                    setSelectedCampusId(e.target.value)
                    setActiveFloor(null)
                    setPathFrom(null)
                    setPathTo(null)
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Choose Campus --</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {selectedCampusId && (
                  <button className="danger" onClick={triggerDeleteCampusModal} title="Delete Campus" style={{ padding: '8px 10px' }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleCreateCampus} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <input 
                placeholder="New Campus name" 
                value={newCampusName} 
                onChange={(e) => setNewCampusName(e.target.value)} 
                style={{ padding: '8px 10px', fontSize: '0.8125rem' }}
                required
              />
              <button type="submit" style={{ width: '100%', padding: '6px 10px', justifyContent: 'center' }}>
                <Plus size={14} /> Add Campus
              </button>
            </form>
          </div>

          {selectedCampusId && (
            <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3>Campus Layout Structures</h3>
              
              <div className="accordion-list">
                {buildings.map(b => {
                  const isOpen = openBuildingId === b.id
                  return (
                    <div key={b.id} className="accordion-group">
                      <button 
                        className="accordion-header" 
                        onClick={() => setOpenBuildingId(isOpen ? '' : b.id)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <School size={15} style={{ color: 'var(--primary)' }} />
                          {b.name}
                        </span>
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {isOpen && (
                        <div className="accordion-content">
                          {(!b.floors || b.floors.length === 0) ? (
                            <p className="muted" style={{ padding: '8px', fontSize: '0.75rem', fontStyle: 'italic' }}>
                              No floors added. Use input below:
                            </p>
                          ) : (
                            b.floors
                              .slice()
                              .sort((x, y) => x.level - y.level)
                              .map(f => (
                                <button
                                  key={f.id}
                                  className={`accordion-floor-btn ${activeFloor?.id === f.id ? 'active' : ''}`}
                                  onClick={() => setActiveFloor(f)}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Layers size={13} />
                                    {f.name}
                                  </span>
                                  {f.floor_plan_url ? (
                                    <span style={{ color: 'var(--success)', fontSize: '10px' }}>plan ✓</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>no plan</span>
                                  )}
                                </button>
                              ))
                          )}
                          
                          <form 
                            onSubmit={(e) => handleCreateFloor(b.id, e)} 
                            style={{ display: 'flex', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}
                          >
                            <input 
                              placeholder="Floor name" 
                              value={newFloorName} 
                              onChange={(e) => setNewFloorName(e.target.value)}
                              style={{ flex: 1, padding: '4px 6px', fontSize: '0.75rem' }}
                              required
                            />
                            <input 
                              placeholder="Lvl" 
                              type="number"
                              value={newFloorLevel} 
                              onChange={(e) => setNewFloorLevel(e.target.value)}
                              style={{ width: '40px', padding: '4px 4px', fontSize: '0.75rem', textAlign: 'center' }}
                              required
                            />
                            <button type="submit" style={{ padding: '4px 8px' }} title="Add Floor">
                              <Plus size={12} />
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleCreateBuilding} style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <input 
                  placeholder="New Building name" 
                  value={newBuildingName} 
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', fontSize: '0.8125rem' }}
                  required
                />
                <button type="submit" className="primary" style={{ padding: '8px' }} title="Add Building">
                  <Plus size={14} />
                </button>
              </form>
            </div>
          )}

          {pathResult && routeInstructions.length > 0 && (
            <div className="instruction-panel">
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Interactive Navigation</span>
                <span style={{ fontSize: '0.75rem', textTransform: 'none', color: '#ffb03a' }}>
                  {pathResult.distance}m total
                </span>
              </h3>
              
              <div className="instruction-list">
                {routeInstructions.map((step, idx) => {
                  const isCurrent = activeStepIndex === idx
                  const isCompleted = idx < activeStepIndex

                  return (
                    <div 
                      key={idx} 
                      className={`instruction-step ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                      onClick={() => {
                        setActiveStepIndex(idx)
                        const stepNode = nodes.find(n => n.id === step.nodeId)
                        if (stepNode) centerOnNode(stepNode)
                      }}
                      title="Click to focus map on this checkpoint"
                    >
                      <div className="instruction-step-icon">
                        {getInstructionIcon(step.type)}
                      </div>
                      <div className="instruction-step-text" style={{ flex: 1 }}>
                        {step.text}
                      </div>
                      
                      <input 
                        type="checkbox" 
                        checked={idx <= activeStepIndex}
                        onChange={(e) => {
                          e.stopPropagation()
                          setActiveStepIndex(e.target.checked ? idx : Math.max(0, idx - 1))
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        <main className="studio-main-panel">
          {!activeFloor ? (
            <div className="floor-studio-empty">
              <Compass size={64} style={{ color: 'var(--border)', strokeWidth: '1' }} />
              <div>
                <h2>No Floor Selected</h2>
                <p className="muted" style={{ maxWidth: '450px', margin: '8px auto 0' }}>
                  Select a Campus first. Create a Building and Floor on the left, then click on the Floor level to load the interactive designer blueprint.
                </p>
              </div>
            </div>
          ) : (
            <div className="editor" style={{ position: 'relative' }}>
              
              <div className="editor-header">
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>{activeFloor.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Map blueprint (Draw nodes and corridor paths)
                  </span>
                </div>

                <div className="toolbar">
                  {activeFloor.floor_plan_url && (
                    <button 
                      onClick={handleAutoDetectRooms} 
                      disabled={scanning}
                      style={{ 
                        background: 'var(--success-glow)', 
                        borderColor: 'rgba(16, 185, 129, 0.25)', 
                        color: 'var(--success)',
                        fontWeight: 600
                      }}
                      title="Automatically scans blueprint layout and registers room pins using OCR"
                    >
                      <Search size={14} />
                      {scanning ? 'Scanning...' : 'Auto-Detect Rooms'}
                    </button>
                  )}

                  <button 
                    className={tool === 'select' ? 'active' : ''} 
                    onClick={() => { setTool('select'); setConnectFrom(null); }}
                  >
                    <MousePointer size={14} />
                    Select / Drag
                  </button>
                  
                  <button 
                    className={tool === 'add' ? 'active' : ''} 
                    onClick={() => { setTool('add'); setConnectFrom(null); }}
                  >
                    <PlusCircle size={14} />
                    Add Node
                  </button>

                  {tool === 'add' && (
                    <select value={nodeType} onChange={(e) => setNodeType(e.target.value)} style={{ padding: '6px' }}>
                      {NODE_TYPES.map(t => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                  )}

                  <button 
                    className={tool === 'connect' ? 'active' : ''} 
                    onClick={() => { setTool('connect'); setConnectFrom(null); }}
                  >
                    <Link2 size={14} />
                    Connect Path
                  </button>

                  <button 
                    className={tool === 'path' ? 'active' : ''} 
                    onClick={() => { setTool('path'); setPathFrom(null); setPathTo(null); }}
                  >
                    <Route size={14} />
                    Test Route
                  </button>

                  <label className="upload-btn" style={{ padding: '6px 12px' }}>
                    <UploadCloud size={14} />
                    {uploading ? 'Uploading...' : 'Upload Plan'}
                    <input type="file" accept="image/*" onChange={handleUpload} hidden disabled={uploading} />
                  </label>

                  {activeFloor.floor_plan_url && (
                    <button
                      onClick={() => setShowCalibrationHUD(prev => !prev)}
                      className={showCalibrationHUD ? 'active' : ''}
                      style={{
                        background: showCalibrationHUD ? 'var(--primary)' : 'rgba(255, 255, 255, 0.03)',
                        borderColor: showCalibrationHUD ? 'var(--primary)' : 'var(--border)',
                        padding: '6px 12px'
                      }}
                    >
                      <Sliders size={14} />
                      Align Map
                    </button>
                  )}
                </div>
              </div>

              {showCalibrationHUD && (
                <div className="calibration-hud" onMouseDown={e => e.stopPropagation()}>
                  <h4>
                    <span>Floor Alignment Calibration</span>
                    <button 
                      onClick={() => setShowCalibrationHUD(false)} 
                      style={{ padding: '2px', border: 'none', background: 'transparent' }}
                    >
                      <X size={14} />
                    </button>
                  </h4>
                  
                  <div className="calibration-row">
                    <label>
                      <span>X Translation:</span>
                      <strong>{calibrationX}px</strong>
                    </label>
                    <input 
                      type="range" 
                      min="-300" 
                      max="300" 
                      step="1"
                      value={calibrationX} 
                      onChange={e => setCalibrationX(parseInt(e.target.value, 10))} 
                    />
                  </div>

                  <div className="calibration-row">
                    <label>
                      <span>Y Translation:</span>
                      <strong>{calibrationY}px</strong>
                    </label>
                    <input 
                      type="range" 
                      min="-300" 
                      max="300" 
                      step="1"
                      value={calibrationY} 
                      onChange={e => setCalibrationY(parseInt(e.target.value, 10))} 
                    />
                  </div>

                  <div className="calibration-row">
                    <label>
                      <span>Scale Multiplier:</span>
                      <strong>{calibrationScale.toFixed(2)}x</strong>
                    </label>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2.5" 
                      step="0.01"
                      value={calibrationScale} 
                      onChange={e => setCalibrationScale(parseFloat(e.target.value))} 
                    />
                  </div>

                  <div className="calibration-row">
                    <label>
                      <span>Rotation Angle:</span>
                      <strong>{calibrationRotation}°</strong>
                    </label>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="1"
                      value={calibrationRotation} 
                      onChange={e => setCalibrationRotation(parseInt(e.target.value, 10))} 
                    />
                  </div>

                  <div className="calibration-toggles">
                    <div className="calibration-row" style={{ marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.7rem' }}>Reference Floor for Overlay:</label>
                      <select 
                        value={refFloorId} 
                        onChange={e => setRefFloorId(e.target.value)}
                        style={{ padding: '4px 6px', fontSize: '0.75rem', width: '100%', marginTop: '2px' }}
                      >
                        <option value="">-- No Reference Floor --</option>
                        {buildings
                          .find(b => (b.floors || []).some(f => f.id === activeFloor.id))
                          ?.floors.filter(f => f.id !== activeFloor.id)
                          .map(f => (
                            <option key={f.id} value={f.id}>{f.name} (Lvl {f.level})</option>
                          ))
                        }
                      </select>
                    </div>

                    {refFloorId && (
                      <>
                        <div className="calibration-toggle-item">
                          <span>Show Reference Plan Image</span>
                          <input 
                            type="checkbox" 
                            checked={showRefFloorPlan} 
                            onChange={e => setShowRefFloorPlan(e.target.checked)} 
                          />
                        </div>

                        {showRefFloorPlan && (
                          <div className="calibration-row">
                            <label>
                              <span>Ref Plan Opacity:</span>
                              <strong>{Math.round(refOpacity * 100)}%</strong>
                            </label>
                            <input 
                              type="range" 
                              min="0.1" 
                              max="0.9" 
                              step="0.05"
                              value={refOpacity} 
                              onChange={e => setRefOpacity(parseFloat(e.target.value))} 
                            />
                          </div>
                        )}

                        <div className="calibration-toggle-item">
                          <span>Show Reference Nodes Overlay</span>
                          <input 
                            type="checkbox" 
                            checked={showRefNodes} 
                            onChange={e => setShowRefNodes(e.target.checked)} 
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="calibration-actions">
                    <button onClick={handleResetCalibration}>Reset</button>
                    <button className="primary" onClick={handleSaveCalibration}>Save Alignment</button>
                  </div>
                </div>
              )}

              <div 
                className="canvas-wrap"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                
                {scanning && (
                  <div className="ocr-scan-overlay">
                    <div className="scan-line"></div>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>AI Blueprint OCR Engine</h4>
                      <p className="muted" style={{ fontSize: '0.875rem' }}>{scanProgress}</p>
                    </div>
                  </div>
                )}

                {tool === 'connect' && connectFrom && (connectFrom.type === 'stair' || connectFrom.type === 'lift') && (
                  <div className="cross-floor-hud" onMouseDown={e => e.stopPropagation()}>
                    <h4>Cross-Floor Connection</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Connect stair/lift <strong>{connectFrom.label}</strong> to another floor's hub:
                    </p>
                    {crossFloorOptions.length === 0 ? (
                      <p className="muted" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                        No stairs/lifts created on other floors yet.
                      </p>
                    ) : (
                      <>
                        <select 
                          value={targetCrossFloorNodeId}
                          onChange={e => setTargetCrossFloorNodeId(e.target.value)}
                        >
                          <option value="">-- Choose Link Target --</option>
                          {crossFloorOptions.map(n => {
                            const nodeFloor = buildings
                              .flatMap(b => b.floors || [])
                              .find(f => f.id === n.floor_id)
                            const recommendation = n.isAligned 
                              ? `🌟 (Aligned - recommended)` 
                              : `(${Math.round(n.distanceToSource)}px offset)`
                            return (
                              <option key={n.id} value={n.id}>
                                {nodeFloor?.name || 'Floor'} &rarr; {n.label} {recommendation}
                              </option>
                            )
                          })}
                        </select>
                        <button 
                          className="primary" 
                          onClick={handleCreateCrossFloorLink}
                          disabled={!targetCrossFloorNodeId}
                          style={{ padding: '6px 10px', fontSize: '0.75rem', justifyContent: 'center' }}
                        >
                          Establish Link
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => setConnectFrom(null)}
                      style={{ padding: '6px 10px', fontSize: '0.75rem', justifyContent: 'center' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {loadingMap ? (
                  <div className="center" style={{ background: 'transparent', height: '100%' }}>
                    <div className="loading-spinner"></div>
                  </div>
                ) : (
                  <svg 
                    ref={svgRef} 
                    viewBox="0 0 1000 1000" 
                    className="canvas"
                    onClick={handleCanvasClick}
                  >
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                      
                      {showRefFloorPlan && refFloorId && (() => {
                        const refFloor = buildings
                          .flatMap(b => b.floors || [])
                          .find(f => f.id === refFloorId)
                        if (!refFloor || !refFloor.floor_plan_url) return null
                        const refCal = refFloor.metadata?.calibration || { x_offset: 0, y_offset: 0, scale: 1, rotation: 0 }
                        return (
                          <image 
                            href={refFloor.floor_plan_url} 
                            x="0" 
                            y="0" 
                            width="1000" 
                            height="1000" 
                            preserveAspectRatio="xMidYMid meet"
                            opacity={refOpacity}
                            transform={`translate(${refCal.x_offset ?? 0}, ${refCal.y_offset ?? 0}) scale(${refCal.scale ?? 1}) rotate(${refCal.rotation ?? 0}, 500, 500)`}
                            style={{ transformOrigin: '500px 500px', pointerEvents: 'none' }}
                          />
                        )
                      })()}

                      {showRefNodes && refFloorId && allCampusNodes
                        .filter(n => n.floor_id === refFloorId)
                        .map(refNode => (
                          <g 
                            key={`ref-${refNode.id}`}
                            transform={`translate(${refNode.x}, ${refNode.y})`}
                            style={{ opacity: 0.5, pointerEvents: 'none' }}
                          >
                            <circle 
                              r="8" 
                              fill="none"
                              stroke="#ec4899"
                              strokeWidth="2"
                              strokeDasharray="3, 3"
                            />
                            <circle 
                              r="2"
                              fill="#ec4899"
                            />
                            <text 
                              x="12" 
                              y="4" 
                              fill="#ec4899"
                              style={{ fontSize: '10px', fontWeight: 600, pointerEvents: 'none' }}
                            >
                              {refNode.label} (Ref)
                            </text>
                          </g>
                        ))}

                      {activeFloor.floor_plan_url && (
                        <image 
                          href={activeFloor.floor_plan_url} 
                          x="0" 
                          y="0" 
                          width="1000" 
                          height="1000" 
                          preserveAspectRatio="xMidYMid meet"
                          transform={`translate(${calibrationX}, ${calibrationY}) scale(${calibrationScale}) rotate(${calibrationRotation}, 500, 500)`}
                          style={{ transformOrigin: '500px 500px' }}
                        />
                      )}

                      {edges.map(edge => {
                        const fromNode = nodes.find(n => n.id === edge.from_node_id)
                        const toNode = nodes.find(n => n.id === edge.to_node_id)
                        if (!fromNode || !toNode) return null

                        const inPath = 
                          pathSet.has(fromNode.id) && 
                          pathSet.has(toNode.id) &&
                          Math.abs(pathResult.order[fromNode.id] - pathResult.order[toNode.id]) === 1

                        const midX = (fromNode.x + toNode.x) / 2
                        const midY = (fromNode.y + toNode.y) / 2

                        return (
                          <g key={edge.id}>
                            <line 
                              x1={fromNode.x}
                              y1={fromNode.y}
                              x2={toNode.x}
                              y2={toNode.y}
                              stroke={inPath ? '#f97316' : '#4b5563'}
                              strokeWidth={inPath ? 5 : 2}
                              strokeDasharray={inPath ? '8, 8' : 'none'}
                              style={inPath ? { animation: 'dash 1s linear infinite', cursor: 'pointer' } : { cursor: 'pointer' }}
                              onClick={(e) => triggerEdgeModal(edge, e)}
                            />
                            <g transform={`translate(${midX}, ${midY})`} style={{ pointerEvents: 'none' }}>
                              <rect
                                x="-14"
                                y="-8"
                                width="28"
                                height="16"
                                rx="8"
                                fill="#1e293b"
                                stroke={inPath ? '#f97316' : '#4b5563'}
                                strokeWidth="1"
                                opacity="0.9"
                              />
                              <text
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={inPath ? '#fb923c' : '#9ca3af'}
                                style={{ fontSize: '8px', fontWeight: 'bold', fontFamily: 'sans-serif' }}
                              >
                                {Math.round(edge.weight)}m
                              </text>
                            </g>
                          </g>
                        )
                      })}

                      {nodes.map(node => {
                        const selected =
                          connectFrom?.id === node.id || 
                          pathFrom?.id === node.id || 
                          pathTo?.id === node.id

                        const inPath = pathSet.has(node.id)
                        const isCurrentGPSNode = activeStepNodeId === node.id

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={(e) => handleNodeClick(node, e)}
                            onMouseDown={(e) => handleNodeMouseDown(node, e)}
                            onContextMenu={(e) => triggerDeleteNodeModal(node, e)}
                            className="node-handle"
                          >
                            {isCurrentGPSNode && (
                              <circle 
                                r="18" 
                                fill="none" 
                                stroke="#10b981" 
                                strokeWidth="3"
                                className="pulse-circle"
                              />
                            )}

                            <circle 
                              r="8"
                              fill={colorForType(node.type)}
                              stroke={selected ? '#ffffff' : (inPath ? '#f97316' : 'rgba(0, 0, 0, 0.4)')}
                              strokeWidth={selected ? '2.5' : (inPath ? '2' : '1')}
                              style={selected || inPath ? { filter: `drop-shadow(0 0 6px ${inPath ? '#f97316' : 'var(--primary)'})` } : {}}
                            />
                            
                            <text x="12" y="4" fill="#e5e7eb">{node.label}</text>
                          </g>
                        )
                      })}
                    </g>
                  </svg>
                )}

                <div className="zoom-hud">
                  <button onClick={zoomIn} title="Zoom In"><ZoomIn size={15} /></button>
                  <button onClick={zoomOut} title="Zoom Out"><ZoomOut size={15} /></button>
                  <button onClick={resetZoom} title="Reset"><RotateCcw size={15} /></button>
                  <div className="zoom-level">{Math.round(scale * 100)}%</div>
                </div>
              </div>

              {pathResult && (
                <div className="path-info">
                  {pathResult.path.length ? (
                    <span>
                      Active route: <strong>{pathResult.distance}m</strong> distance over <strong>{pathResult.path.length}</strong> points.
                    </span>
                  ) : (
                    <span>No path found. Ensure your nodes are connected by edges.</span>
                  )}
                  <button onClick={() => { setPathFrom(null); setPathTo(null); }}>Clear route</button>
                </div>
              )}

              <p className="hint">
                <HelpCircle size={14} style={{ color: 'var(--primary)' }} />
                {tool === 'select' && 'Select tool: Drag nodes to position them. Right-click node to delete. Click edge to delete/edit distance.'}
                {tool === 'add' && `Add node tool: Click the layout grid to create a "${nodeType.toUpperCase()}" node.`}
                {tool === 'connect' && 'Connect tool: Link two nodes. Select stairs/lifts to create cross-floor routing bridges.'}
                {tool === 'path' && 'Test Route tool: Choose starting and arrival nodes to run Dijkstra and resolve turn directions.'}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
