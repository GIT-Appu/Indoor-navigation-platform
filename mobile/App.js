import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  PanResponder,
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G, Image as SvgImage } from 'react-native-svg';
import { supabase } from './supabase';
import { solveDijkstra } from './dijkstra';

const { width } = Dimensions.get('window');
const canvasSize = width - 48; // Padding of 24 on left/right

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Welcome');
  const [selectedCampus, setSelectedCampus] = useState(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Welcome':
        return <WelcomeScreen onEnter={() => setCurrentScreen('CampusList')} />;
      case 'CampusList':
        return (
          <CampusListScreen
            onSelectCampus={(campus) => {
              setSelectedCampus(campus);
              setCurrentScreen('Navigation');
            }}
            onBack={() => setCurrentScreen('Welcome')}
          />
        );
      case 'Navigation':
        return (
          <NavigationScreen
            campusId={selectedCampus?.id}
            campusName={selectedCampus?.name}
            onBack={() => setCurrentScreen('CampusList')}
          />
        );
      default:
        return <WelcomeScreen onEnter={() => setCurrentScreen('CampusList')} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {renderScreen()}
    </SafeAreaView>
  );
}

// 1. Welcome Screen Component
function WelcomeScreen({ onEnter }) {
  return (
    <View style={welcomeStyles.wrap}>
      <View style={welcomeStyles.gridBackground}>
        {/* Draw subtle business grids */}
        {Array.from({ length: 15 }).map((_, i) => (
          <View key={`h-${i}`} style={[welcomeStyles.gridLineH, { top: i * 60 }]} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={`v-${i}`} style={[welcomeStyles.gridLineV, { left: i * 60 }]} />
        ))}
      </View>

      <View style={welcomeStyles.content}>
        <View style={welcomeStyles.spacer} />

        {/* Brand identity */}
        <View style={welcomeStyles.brandContainer}>
          <View style={welcomeStyles.logoRing}>
            <View style={welcomeStyles.logoDot} />
          </View>
          <Text style={welcomeStyles.title}>
            Indoor<Text style={{ fontWeight: '300' }}>Nav</Text>
          </Text>
          <Text style={welcomeStyles.subtitle}>PRECISE VENUE WAYFINDING</Text>
        </View>

        {/* Bottom CTA */}
        <View style={welcomeStyles.bottomContainer}>
          <TouchableOpacity style={welcomeStyles.button} onPress={onEnter} activeOpacity={0.8}>
            <Text style={welcomeStyles.arrowText}>→</Text>
          </TouchableOpacity>
          <Text style={welcomeStyles.ctaText}>ENTER PLATFORM</Text>
        </View>
      </View>
    </View>
  );
}

// 2. Campus List Screen Component
function CampusListScreen({ onSelectCampus, onBack }) {
  const [campuses, setCampuses] = useState([]);
  const [filteredCampuses, setFilteredCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCampuses();
  }, []);

  const fetchCampuses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampuses(data || []);
      setFilteredCampuses(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFilteredCampuses(campuses);
    } else {
      const filtered = campuses.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        return name.includes(text.toLowerCase()) || desc.includes(text.toLowerCase());
      });
      setFilteredCampuses(filtered);
    }
  };

  return (
    <View style={listStyles.wrap}>
      <View style={listStyles.header}>
        <TouchableOpacity style={listStyles.backBtn} onPress={onBack}>
          <Text style={listStyles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={listStyles.headerTitle}>Select Campus</Text>
      </View>

      <View style={listStyles.searchContainer}>
        <TextInput
          style={listStyles.searchInput}
          placeholder="Search campuses..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <View style={listStyles.center}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : filteredCampuses.length === 0 ? (
        <View style={listStyles.center}>
          <Text style={listStyles.emptyText}>No campuses found.</Text>
          <TouchableOpacity style={listStyles.retryBtn} onPress={fetchCampuses}>
            <Text style={listStyles.retryText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={listStyles.listScroll} contentContainerStyle={listStyles.listContent}>
          {filteredCampuses.map((campus) => (
            <TouchableOpacity
              key={campus.id}
              style={listStyles.card}
              onPress={() => onSelectCampus(campus)}
              activeOpacity={0.7}
            >
              <View style={listStyles.cardInfo}>
                <Text style={listStyles.cardName}>{campus.name}</Text>
                <Text style={listStyles.cardDesc} numberOfLines={2}>
                  {campus.description || 'No description available.'}
                </Text>
              </View>
              <Text style={listStyles.cardArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// 3. Navigation Screen Component
function NavigationScreen({ campusId, campusName, onBack }) {
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [startNode, setStartNode] = useState(null);
  const [endNode, setEndNode] = useState(null);
  const [solvedPath, setSolvedPath] = useState([]);
  const [activeStepNodeId, setActiveStepNodeId] = useState(null);
  const [completedStepIndex, setCompletedStepIndex] = useState(-1);

  const [loadingData, setLoadingData] = useState(true);

  // Custom Modal Picker states
  const [buildingPickerVisible, setBuildingPickerVisible] = useState(false);
  const [floorPickerVisible, setFloorPickerVisible] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  // Zoom & Pan states — pan is the SVG coordinate at viewport center
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 500, y: 500 });
  const panRef = useRef({ x: 500, y: 500 });
  const scaleRef = useRef(1);
  const panStart = useRef({ x: 500, y: 500 });

  // Keep refs in sync so PanResponder closures always have current values
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Compute dynamic SVG viewBox from scale + pan
  const viewW = 1000 / scale;
  const viewH = 1000 / scale;
  const viewX = pan.x - viewW / 2;
  const viewY = pan.y - viewH / 2;
  const dynamicViewBox = `${viewX} ${viewY} ${viewW} ${viewH}`;

  // Ref for wheel-to-zoom on web (callback ref so it works when map mounts later)
  const canvasRef = useRef(null);
  const containerSizeRef = useRef(canvasSize);
  const wheelCleanupRef = useRef(null);

  const setCanvasRef = (node) => {
    // Cleanup previous listener
    if (wheelCleanupRef.current) {
      wheelCleanupRef.current();
      wheelCleanupRef.current = null;
    }
    canvasRef.current = node;
    if (Platform.OS !== 'web' || !node) return;

    const handleWheel = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setScale((s) => Math.min(5, s * 1.15));
      } else {
        setScale((s) => Math.max(0.5, s / 1.15));
      }
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    wheelCleanupRef.current = () => node.removeEventListener('wheel', handleWheel);
  };

  const handleCanvasLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    containerSizeRef.current = Math.min(width, height);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        panStart.current = { x: panRef.current.x, y: panRef.current.y };
      },
      onPanResponderMove: (evt, gestureState) => {
        const curScale = scaleRef.current;
        const svgPerPx = 1000 / (curScale * containerSizeRef.current);
        setPan({
          x: panStart.current.x - gestureState.dx * svgPerPx,
          y: panStart.current.y - gestureState.dy * svgPerPx,
        });
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  useEffect(() => {
    fetchCampusStructures();
  }, [campusId]);

  const fetchCampusStructures = async () => {
    try {
      setLoadingData(true);
      // Fetch buildings and floors
      const { data: bData, error: bErr } = await supabase
        .from('buildings')
        .select('*, floors(*)')
        .eq('campus_id', campusId)
        .order('name');

      if (bErr) throw bErr;
      setBuildings(bData || []);

      // Flatten floors list and extract floor IDs
      const flatFloors = [];
      const floorIds = [];
      (bData || []).forEach((b) => {
        const sortedF = [...(b.floors || [])].sort((a, b) => (a.level || 0) - (b.level || 0));
        flatFloors.push(...sortedF);
        sortedF.forEach((f) => floorIds.push(f.id));
      });
      setFloors(flatFloors);

      if (floorIds.length === 0) {
        setLoadingData(false);
        return;
      }

      // Fetch all nodes for these floors
      const { data: nData, error: nErr } = await supabase
        .from('nodes')
        .select('*')
        .in('floor_id', floorIds);

      if (nErr) throw nErr;
      setAllNodes(nData || []);

      // Fetch all edges starting from these nodes
      const nodeIds = (nData || []).map((n) => n.id);
      let edgesData = [];
      if (nodeIds.length > 0) {
        const { data: eData, error: eErr } = await supabase
          .from('edges')
          .select('*')
          .in('from_node_id', nodeIds);
        if (eErr) throw eErr;
        edgesData = eData || [];
      }
      setAllEdges(edgesData);

      // Select first building and floor by default
      if (bData && bData.length > 0) {
        const defaultBuilding = bData[0];
        setSelectedBuilding(defaultBuilding);
        const sortedF = [...(defaultBuilding.floors || [])].sort((a, b) => (a.level || 0) - (b.level || 0));
        if (sortedF.length > 0) {
          setSelectedFloor(sortedF[0]);
        }
      }
    } catch (e) {
      console.error('Error loading campus structures:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectBuilding = (building) => {
    setSelectedBuilding(building);
    const sortedF = [...(building.floors || [])].sort((a, b) => (a.level || 0) - (b.level || 0));
    if (sortedF.length > 0) {
      setSelectedFloor(sortedF[0]);
    } else {
      setSelectedFloor(null);
    }
  };

  const handleSelectFloor = (floor) => {
    setSelectedFloor(floor);
  };

  const handleCalculateRoute = (start, end) => {
    if (!start || !end) {
      setSolvedPath([]);
      return;
    }
    const path = solveDijkstra(allNodes, allEdges, start.id, end.id);
    setSolvedPath(path);
    setActiveStepNodeId(null);
    setCompletedStepIndex(-1);

    // Auto-focus starting node floor
    if (path && path.length > 0) {
      const firstNode = allNodes.find((n) => n.id === path[0]);
      if (firstNode) {
        const startFloor = floors.find((f) => f.id === firstNode.floor_id);
        if (startFloor) {
          setSelectedFloor(startFloor);
          const startBuilding = buildings.find((b) => (b.floors || []).some((f) => f.id === startFloor.id));
          if (startBuilding) setSelectedBuilding(startBuilding);
        }
      }
    }
  };

  const zoomIn = () => setScale((s) => Math.min(5, s * 1.3));
  const zoomOut = () => setScale((s) => Math.max(0.5, s / 1.3));
  const resetZoom = () => {
    setScale(1);
    setPan({ x: 500, y: 500 });
  };

  const handleSelectStep = (step) => {
    const node = allNodes.find((n) => n.id === step.nodeId);
    if (!node) return;

    // Switch floor
    const stepFloor = floors.find((f) => f.id === step.floorId);
    if (stepFloor) {
      setSelectedFloor(stepFloor);
      const building = buildings.find((b) => (b.floors || []).some((f) => f.id === step.floorId));
      if (building) setSelectedBuilding(building);
    }

    // Zoom in and center the viewport on this node's SVG coordinates
    const targetScale = 2;
    setScale(targetScale);
    setPan({ x: node.x, y: node.y });
    setActiveStepNodeId(node.id);
  };

  const handleToggleStepDone = (idx, e) => {
    e.stopPropagation();
    if (completedStepIndex >= idx) {
      setCompletedStepIndex(idx - 1);
    } else {
      setCompletedStepIndex(idx);
      // Highlight next step without zooming/panning
      if (idx < routeInstructions.length - 1) {
        const nextStep = routeInstructions[idx + 1];
        setActiveStepNodeId(nextStep.nodeId);
        // Switch floor if needed
        const stepFloor = floors.find((f) => f.id === nextStep.floorId);
        if (stepFloor) {
          setSelectedFloor(stepFloor);
          const building = buildings.find((b) => (b.floors || []).some((f) => f.id === nextStep.floorId));
          if (building) setSelectedBuilding(building);
        }
      }
    }
  };

  const activeNodes = useMemo(() => {
    if (!selectedFloor) return [];
    return allNodes.filter((n) => n.floor_id === selectedFloor.id);
  }, [allNodes, selectedFloor]);

  const activeNodeIds = useMemo(() => new Set(activeNodes.map((n) => n.id)), [activeNodes]);

  const activeEdges = useMemo(() => {
    return allEdges.filter((e) => activeNodeIds.has(e.from_node_id) && activeNodeIds.has(e.to_node_id));
  }, [allEdges, activeNodeIds]);

  const nodeMap = useMemo(() => {
    return new Map(allNodes.map((n) => [n.id, n]));
  }, [allNodes]);

  const routeInstructions = useMemo(() => {
    if (solvedPath.length === 0) return [];
    return generateInstructions(solvedPath, allNodes, allEdges, buildings);
  }, [solvedPath, allNodes, allEdges, buildings]);

  const totalDistance = useMemo(() => {
    if (solvedPath.length < 2) return 0;
    let dist = 0;
    const getDist = (n1, n2) => {
      const edge = allEdges.find(
        (e) =>
          (e.from_node_id === n1.id && e.to_node_id === n2.id) ||
          (e.from_node_id === n2.id && e.to_node_id === n1.id)
      );
      if (edge) return Number(edge.weight);
      return Math.max(1, Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y) * 0.08));
    };

    for (let i = 1; i < solvedPath.length; i++) {
      const n1 = nodeMap.get(solvedPath[i - 1]);
      const n2 = nodeMap.get(solvedPath[i]);
      if (n1 && n2) {
        dist += getDist(n1, n2);
      }
    }
    return Math.round(dist);
  }, [solvedPath, allEdges, nodeMap]);

  const getCleanLabel = (node) => {
    if (!node) return '';
    const nodeLabel = node.label && node.label.trim() !== '' ? node.label : `${node.type.toUpperCase()} (${Math.round(node.x)}, ${Math.round(node.y)})`;
    const floor = floors.find((f) => f.id === node.floor_id);
    const building = floor ? buildings.find((b) => (b.floors || []).some((f) => f.id === floor.id)) : null;
    
    const floorName = floor ? floor.name : '';
    const buildingName = building ? building.name : '';
    
    if (floorName && buildingName) {
      return `${nodeLabel} — ${floorName} (${buildingName})`;
    }
    return nodeLabel;
  };

  const getColorForType = (type) => {
    switch (type.toLowerCase()) {
      case 'room':
        return '#000000';
      case 'stair':
        return '#888888';
      case 'lift':
        return '#888888';
      case 'entrance':
        return '#000000';
      case 'poi':
        return '#333333';
      default:
        return '#CCCCCC';
    }
  };

  return (
    <View style={navStyles.wrap}>
      {/* Header */}
      <View style={navStyles.header}>
        <TouchableOpacity style={navStyles.backBtn} onPress={onBack}>
          <Text style={navStyles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={navStyles.headerTitle} numberOfLines={1}>
          {campusName}
        </Text>
      </View>

      {loadingData ? (
        <View style={navStyles.center}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : (
        <View style={navStyles.content}>
          {/* Building and Floor selectors side-by-side */}
          <View style={navStyles.selectorsRow}>
            <TouchableOpacity
              style={navStyles.selectorBtn}
              onPress={() => setBuildingPickerVisible(true)}
            >
              <Text style={navStyles.selectorLabel} numberOfLines={1}>
                🏢 {selectedBuilding ? selectedBuilding.name : 'Select Building'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={navStyles.selectorBtn}
              onPress={() => setFloorPickerVisible(true)}
            >
              <Text style={navStyles.selectorLabel} numberOfLines={1}>
                📐 {selectedFloor ? selectedFloor.name : 'Select Floor'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Map canvas */}
          <View style={navStyles.canvasContainer}>
            {!selectedFloor?.floor_plan_url ? (
              <View style={navStyles.mapPlaceholder}>
                <Text style={navStyles.placeholderText}>No floor plan available</Text>
              </View>
            ) : (
              <View
                ref={setCanvasRef}
                style={navStyles.canvasWrapper}
                onLayout={handleCanvasLayout}
                {...panResponder.panHandlers}
              >
                <Svg viewBox={dynamicViewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                      {/* Background floor plan image */}
                      {selectedFloor?.floor_plan_url && (
                        <SvgImage
                          href={Platform.OS === 'web' ? selectedFloor.floor_plan_url : { uri: selectedFloor.floor_plan_url }}
                          x="0"
                          y="0"
                          width="1000"
                          height="1000"
                          preserveAspectRatio="xMidYMid meet"
                        />
                      )}

                      {/* 1. Draw Normal Edges */}
                      {activeEdges.map((edge) => {
                        const fromNode = nodeMap.get(edge.from_node_id);
                        const toNode = nodeMap.get(edge.to_node_id);
                        if (!fromNode || !toNode) return null;

                        // Check if edge is in solved path on this floor
                        let inPath = false;
                        for (let i = 0; i < solvedPath.length - 1; i++) {
                          if (
                            ((solvedPath[i] === fromNode.id && solvedPath[i + 1] === toNode.id) ||
                              (solvedPath[i] === toNode.id && solvedPath[i + 1] === fromNode.id)) &&
                            fromNode.floor_id === selectedFloor.id &&
                            toNode.floor_id === selectedFloor.id
                          ) {
                            inPath = true;
                            break;
                          }
                        }

                        if (!inPath) {
                          return (
                            <Line
                              key={edge.id}
                              x1={fromNode.x}
                              y1={fromNode.y}
                              x2={toNode.x}
                              y2={toNode.y}
                              stroke="#E5E5E5"
                              strokeWidth={2}
                            />
                          );
                        }
                        return null;
                      })}

                      {/* 2. Draw Shortest Path Edges */}
                      {solvedPath.map((nodeId, idx) => {
                        if (idx === solvedPath.length - 1) return null;
                        const fromNode = nodeMap.get(nodeId);
                        const toNode = nodeMap.get(solvedPath[idx + 1]);
                        if (!fromNode || !toNode) return null;

                        // Only draw if both nodes are on the current selected floor
                        if (fromNode.floor_id === selectedFloor?.id && toNode.floor_id === selectedFloor?.id) {
                          const isSegmentCompleted = completedStepIndex >= idx + 1;
                          return (
                            <Line
                              key={`path-${idx}`}
                              x1={fromNode.x}
                              y1={fromNode.y}
                              x2={toNode.x}
                              y2={toNode.y}
                              stroke={isSegmentCompleted ? "#CCCCCC" : "#000000"}
                              strokeWidth={isSegmentCompleted ? 4 : 8}
                              strokeDasharray={isSegmentCompleted ? "6,6" : undefined}
                              strokeLinecap="round"
                            />
                          );
                        }
                        return null;
                      })}

                      {/* 3. Draw Nodes */}
                      {activeNodes.map((node) => {
                        const isStart = startNode?.id === node.id;
                        const isEnd = endNode?.id === node.id;
                        const isHighlight = activeStepNodeId === node.id;

                        const nodeIdx = solvedPath.indexOf(node.id);
                        const isNodeCompleted = nodeIdx !== -1 && completedStepIndex >= nodeIdx;

                        // Corridor nodes don't need text or large circle unless selected
                        if (node.type.toLowerCase() === 'corridor' && !isStart && !isEnd && !isHighlight) {
                          return (
                            <Circle
                              key={node.id}
                              cx={node.x}
                              cy={node.y}
                              r={4}
                              fill={isNodeCompleted ? "#E5E5E5" : "#CCCCCC"}
                            />
                          );
                        }

                        return (
                          <G key={node.id} opacity={isNodeCompleted && !isHighlight && !isStart && !isEnd ? 0.3 : 1}>
                            <Circle
                              cx={node.x}
                              cy={node.y}
                              r={isHighlight ? 12 : 8}
                              fill={isStart ? '#000000' : isEnd ? '#000000' : isHighlight ? '#000000' : getColorForType(node.type)}
                              stroke="#FFFFFF"
                              strokeWidth={2}
                            />

                            {/* Pulsing ring for selected start/destination/active-step */}
                            {(isStart || isEnd || isHighlight) && (
                              <Circle
                                cx={node.x}
                                cy={node.y}
                                r={isHighlight ? 18 : 14}
                                fill="none"
                                stroke="#000000"
                                strokeWidth={1.5}
                                strokeDasharray="4,4"
                              />
                            )}

                            {node.label && (
                              <SvgText
                                x={node.x}
                                y={node.y - 12}
                                fontSize={12}
                                fontWeight="bold"
                                fill="#000000"
                                textAnchor="middle"
                                stroke="#FFFFFF"
                                strokeWidth={0.5}
                              >
                                {node.label}
                              </SvgText>
                            )}
                          </G>
                        );
                      })}

                      {/* 4. Draw Floor transitions */}
                      {activeNodes.map((node) => {
                        if (!solvedPath.includes(node.id)) return null;
                        const idx = solvedPath.indexOf(node.id);
                        if (idx === -1 || idx === solvedPath.length - 1) return null;

                        const nextNodeId = solvedPath[idx + 1];
                        const nextNode = nodeMap.get(nextNodeId);
                        if (nextNode && nextNode.floor_id !== selectedFloor?.id) {
                          // Node transitions to another floor!
                          const targetFloor = floors.find((f) => f.id === nextNode.floor_id);
                          const isUp = targetFloor ? targetFloor.level > selectedFloor.level : false;
                          const directionText = `${node.type === 'lift' ? '🛗' : '📶'} To ${targetFloor?.name || 'next floor'}`;

                          return (
                            <G key={`trans-${node.id}`}>
                              <Circle
                                cx={node.x}
                                cy={node.y}
                                r={16}
                                fill="none"
                                stroke="#000000"
                                strokeWidth={2}
                              />
                              <SvgText
                                x={node.x}
                                y={node.y + 24}
                                fontSize={11}
                                fontWeight="bold"
                                fill="#000000"
                                textAnchor="middle"
                                stroke="#FFFFFF"
                                strokeWidth={0.5}
                              >
                                {directionText}
                              </SvgText>
                            </G>
                          );
                        }
                        return null;
                      })}
                  </Svg>
              </View>
            )}

            {/* Floating zoom HUD controls — outside inner view, inside canvasContainer */}
            {selectedFloor?.floor_plan_url && (
              <View style={navStyles.zoomHUD}>
                <TouchableOpacity style={navStyles.hudBtn} onPress={zoomIn}>
                  <Text style={navStyles.hudBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={navStyles.hudBtn} onPress={zoomOut}>
                  <Text style={navStyles.hudBtnText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity style={navStyles.hudBtn} onPress={resetZoom}>
                  <Text style={[navStyles.hudBtnText, { fontSize: 16 }]}>↺</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Navigation Path Selection Card */}
          {allNodes.length > 0 && (
            <View style={navStyles.routeCard}>
              <View style={navStyles.routeLineColumn}>
                <View style={navStyles.routeDotGreen} />
                <View style={navStyles.routeDottedLine} />
                <View style={navStyles.routeDotRed} />
              </View>
              <View style={navStyles.routeInputsColumn}>
                <TouchableOpacity
                  style={navStyles.routeInputBtn}
                  onPress={() => setStartPickerVisible(true)}
                >
                  <Text style={navStyles.routeInputLabel}>FROM</Text>
                  <Text style={navStyles.routeInputText} numberOfLines={1}>
                    {startNode ? startNode.label : 'Select starting location...'}
                  </Text>
                </TouchableOpacity>

                <View style={navStyles.routeInputDivider} />

                <TouchableOpacity
                  style={navStyles.routeInputBtn}
                  onPress={() => setEndPickerVisible(true)}
                >
                  <Text style={navStyles.routeInputLabel}>TO</Text>
                  <Text style={navStyles.routeInputText} numberOfLines={1}>
                    {endNode ? endNode.label : 'Select destination room...'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Directions Timeline Panel */}
          <View style={navStyles.directionsPanel}>
            <View style={navStyles.directionsHeader}>
              <Text style={navStyles.directionsTitle}>DIRECTIONS</Text>
              {solvedPath.length > 0 && (
                <Text style={navStyles.distanceBadge}>
                  {totalDistance}m total
                </Text>
              )}
            </View>

            {solvedPath.length === 0 ? (
              <View style={navStyles.emptyDirections}>
                <Text style={navStyles.emptyDirectionsText}>
                  Select your starting room and destination above to compute the shortest wayfinding path.
                </Text>
              </View>
            ) : (
              <ScrollView style={navStyles.stepsScroll} showsVerticalScrollIndicator={false}>
                {routeInstructions.map((step, idx) => {
                  const isHighlighted = activeStepNodeId === step.nodeId;
                  const isCompleted = completedStepIndex >= idx;

                  return (
                    <TouchableOpacity
                      key={`step-${idx}`}
                      style={[
                        navStyles.stepRow,
                        isHighlighted && navStyles.stepRowHighlighted,
                        isCompleted && navStyles.stepRowCompleted,
                      ]}
                      onPress={() => handleSelectStep(step)}
                      activeOpacity={0.7}
                    >
                      <View style={navStyles.stepIconCol}>
                        <Text style={[navStyles.stepEmoji, isCompleted && { opacity: 0.4 }]}>
                          {isCompleted ? '✅' : getDirectionIcon(step.type)}
                        </Text>
                        {idx < routeInstructions.length - 1 && (
                          <View style={[
                            navStyles.stepTimelineLine,
                            isCompleted && navStyles.stepTimelineLineCompleted
                          ]} />
                        )}
                      </View>
                      <View style={navStyles.stepTextCol}>
                        <Text style={[
                          navStyles.stepText,
                          isHighlighted && navStyles.stepTextHighlighted,
                          isCompleted && navStyles.stepTextCompleted
                        ]}>
                          {step.text}
                        </Text>
                      </View>

                      {/* Done Toggle Button */}
                      {idx > 0 && (
                        <TouchableOpacity
                          style={[
                            navStyles.doneToggleBtn,
                            isCompleted && navStyles.doneToggleBtnCompleted
                          ]}
                          onPress={(e) => handleToggleStepDone(idx, e)}
                        >
                          <Text style={[
                            navStyles.doneToggleText,
                            isCompleted && navStyles.doneToggleTextCompleted
                          ]}>
                            {isCompleted ? 'Undo' : 'Done'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* Building Custom Picker Modal */}
      <CustomPickerModal
        visible={buildingPickerVisible}
        title="Select Building"
        options={buildings}
        selectedValue={selectedBuilding}
        onSelect={(b) => {
          handleSelectBuilding(b);
          setBuildingPickerVisible(false);
        }}
        onClose={() => setBuildingPickerVisible(false)}
      />

      {/* Floor Custom Picker Modal */}
      <CustomPickerModal
        visible={floorPickerVisible}
        title="Select Floor"
        options={floors.filter(f => f.building_id === selectedBuilding?.id)}
        selectedValue={selectedFloor}
        onSelect={(f) => {
          handleSelectFloor(f);
          setFloorPickerVisible(false);
        }}
        onClose={() => setFloorPickerVisible(false)}
      />

      {/* Start Node Custom Picker Modal */}
      <CustomPickerModal
        visible={startPickerVisible}
        title="Select Start Location"
        options={allNodes.filter((n) => n.type !== 'corridor').sort((a, b) => (a.label || '').localeCompare(b.label || ''))}
        selectedValue={startNode}
        getOptionLabel={getCleanLabel}
        onSelect={(n) => {
          setStartNode(n);
          setStartPickerVisible(false);
          handleCalculateRoute(n, endNode);
        }}
        onClose={() => setStartPickerVisible(false)}
      />

      {/* End Node Custom Picker Modal */}
      <CustomPickerModal
        visible={endPickerVisible}
        title="Select Destination"
        options={allNodes.filter((n) => n.type !== 'corridor').sort((a, b) => (a.label || '').localeCompare(b.label || ''))}
        selectedValue={endNode}
        getOptionLabel={getCleanLabel}
        onSelect={(n) => {
          setEndNode(n);
          setEndPickerVisible(false);
          handleCalculateRoute(startNode, n);
        }}
        onClose={() => setEndPickerVisible(false)}
      />
    </View>
  );
}

// 4. Custom Picker Modal helper component for clean UI overlays
function CustomPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  getOptionLabel,
}) {
  const [search, setSearch] = useState('');

  // Reset search when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setSearch('');
    }
  }, [visible]);

  const getLabel = (opt) => {
    if (getOptionLabel) return getOptionLabel(opt);
    return opt?.name || opt?.label || '';
  };

  const filteredOptions = options.filter((opt) => {
    const label = getLabel(opt).toLowerCase();
    return label.includes(search.toLowerCase());
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>
          
          {/* Search bar inside Modal */}
          <View style={modalStyles.searchContainer}>
            <TextInput
              style={modalStyles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView contentContainerStyle={modalStyles.scroll}>
            {filteredOptions.length === 0 ? (
              <Text style={modalStyles.noResults}>No matches found</Text>
            ) : (
              filteredOptions.map((opt) => {
                const selected = opt.id === selectedValue?.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[modalStyles.option, selected && modalStyles.optionSelected]}
                    onPress={() => onSelect(opt)}
                  >
                    <Text style={[modalStyles.optionText, selected && modalStyles.optionTextSelected]}>
                      {getLabel(opt)}
                    </Text>
                    {selected && <Text style={modalStyles.selectedCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Direction generation
function generateInstructions(path, nodesData, edgesData, buildingsData) {
  if (!path || path.length < 2) return [];
  const steps = [];
  const nodeMap = new Map(nodesData.map((n) => [n.id, n]));
  
  const getDist = (n1, n2) => {
    const edge = edgesData.find(
      (e) =>
        (e.from_node_id === n1.id && e.to_node_id === n2.id) ||
        (e.from_node_id === n2.id && e.to_node_id === n1.id)
    );
    if (edge) return Math.round(edge.weight);
    return Math.max(1, Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y) * 0.08));
  };

  const floorsMap = new Map();
  buildingsData.forEach((b) => {
    (b.floors || []).forEach((f) => {
      floorsMap.set(f.id, f);
    });
  });

  for (let i = 0; i < path.length; i++) {
    const curId = path[i];
    const cur = nodeMap.get(curId);
    if (!cur) continue;

    if (i === 0) {
      steps.push({
        type: 'start',
        text: `Start navigation at ${cur.label || 'Start Location'}`,
        floorId: cur.floor_id,
        nodeId: cur.id,
      });
      continue;
    }

    const prevId = path[i - 1];
    const prev = nodeMap.get(prevId);
    if (!prev) continue;
    const dist = getDist(prev, cur);

    // Floor transition
    if (cur.floor_id !== prev.floor_id) {
      const prevFloor = floorsMap.get(prev.floor_id);
      const curFloor = floorsMap.get(cur.floor_id);
      const transitionType = prev.type === 'lift' ? 'elevator' : 'stairs';
      
      let direction = '';
      if (prevFloor && curFloor) {
        if (curFloor.level > prevFloor.level) {
          direction = ' UP';
        } else if (curFloor.level < prevFloor.level) {
          direction = ' DOWN';
        }
      }
      
      const destFloorName = curFloor ? curFloor.name : 'target floor';
      
      steps.push({
        type: 'floor_change',
        text: `Take the ${transitionType}${direction} to ${destFloorName}`,
        floorId: cur.floor_id,
        nodeId: cur.id,
      });
      continue;
    }

    let type = 'straight';
    let text = `Walk straight ${dist}m to ${cur.label || 'corridor'}`;

    if (i > 1) {
      const prevPrevId = path[i - 2];
      const prevPrev = nodeMap.get(prevPrevId);
      if (prevPrev && prevPrev.floor_id === prev.floor_id) {
        const dx1 = prev.x - prevPrev.x;
        const dy1 = prev.y - prevPrev.y;
        const dx2 = cur.x - prev.x;
        const dy2 = cur.y - prev.y;

        const angle1 = Math.atan2(dy1, dx1);
        const angle2 = Math.atan2(dy2, dx2);
        let diff = angle2 - angle1;

        while (diff < -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;

        if (diff > 0.4 && diff < 2.2) {
          type = 'right';
          text = `Turn right and walk ${dist}m to ${cur.label || 'checkpoint'}`;
        } else if (diff < -0.4 && diff > -2.2) {
          type = 'left';
          text = `Turn left and walk ${dist}m to ${cur.label || 'checkpoint'}`;
        } else if (Math.abs(diff) >= 2.2) {
          type = 'uturn';
          text = `Make a U-turn and walk ${dist}m to ${cur.label || 'checkpoint'}`;
        }
      }
    }

    steps.push({
      type,
      text,
      floorId: cur.floor_id,
      nodeId: cur.id,
    });
  }

  // Find destination node (last node in path)
  const lastNode = nodeMap.get(path[path.length - 1]);
  if (lastNode && steps.length > 0) {
    steps.push({
      type: 'arrive',
      text: `Arrive at destination: ${lastNode.label || 'Target'}`,
      floorId: lastNode.floor_id,
      nodeId: lastNode.id,
    });
  }

  return steps;
}

const getDirectionIcon = (type) => {
  switch (type) {
    case 'start':
      return '🟢';
    case 'left':
      return '👈';
    case 'right':
      return '👉';
    case 'uturn':
      return '🔄';
    case 'floor_change':
      return '🛗';
    case 'arrive':
      return '📍';
    default:
      return '⬆️';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

const welcomeStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.025)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.025)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingVertical: 40,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spacer: {
    height: 40,
  },
  brandContainer: {
    alignItems: 'center',
  },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#111111',
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    color: '#000000',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#666666',
    marginTop: 12,
  },
  bottomContainer: {
    alignItems: 'center',
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  ctaText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#666666',
  },
});

const listStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  searchInput: {
    height: 48,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    color: '#000000',
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
  },
  cardDesc: {
    fontSize: 13,
    color: '#666666',
    marginTop: 6,
  },
  cardArrow: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 12,
  },
});

const navStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  selectorsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  selectorBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  canvasContainer: {
    flex: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  canvasWrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontWeight: 'bold',
  },
  routeCard: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 12,
    marginBottom: 16,
  },
  routeLineColumn: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  routeDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  routeDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  routeDottedLine: {
    flex: 1,
    width: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#999999',
    marginVertical: 4,
  },
  routeInputsColumn: {
    flex: 1,
    marginLeft: 8,
  },
  routeInputBtn: {
    paddingVertical: 4,
  },
  routeInputLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#999999',
    marginBottom: 2,
  },
  routeInputText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: 'bold',
  },
  routeInputDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  zoomHUD: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 4,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  hudBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  hudBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  directionsPanel: {
    flex: 3,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 16,
  },
  directionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  directionsTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#999999',
  },
  distanceBadge: {
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#000000',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1,
  },
  emptyDirections: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDirectionsText: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  stepsScroll: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginVertical: 2,
  },
  stepRowHighlighted: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  stepRowCompleted: {
    opacity: 0.6,
  },
  stepIconCol: {
    width: 32,
    alignItems: 'center',
  },
  stepEmoji: {
    fontSize: 16,
  },
  stepTimelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E5E5',
    marginTop: 8,
  },
  stepTimelineLineCompleted: {
    backgroundColor: '#CCCCCC',
  },
  stepTextCol: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  stepTextHighlighted: {
    color: '#000000',
    fontWeight: 'bold',
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  doneToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    marginLeft: 8,
  },
  doneToggleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  doneToggleBtnCompleted: {
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  },
  doneToggleTextCompleted: {
    color: '#999999',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeBtn: {
    fontSize: 24,
    color: '#666666',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInput: {
    height: 40,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    color: '#000000',
    fontSize: 14,
  },
  noResults: {
    paddingVertical: 32,
    textAlign: 'center',
    color: '#999999',
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionSelected: {
    backgroundColor: '#F9F9F9',
  },
  optionText: {
    fontSize: 15,
    color: '#333333',
  },
  optionTextSelected: {
    color: '#000000',
    fontWeight: 'bold',
  },
  selectedCheck: {
    color: '#000000',
    fontWeight: 'bold',
  },
});
