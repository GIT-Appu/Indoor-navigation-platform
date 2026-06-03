# CampusNav 🧭

> Turn-by-turn indoor navigation for college campuses — including real-time 3D positioning across floors, corridors, staircases, lifts, and ramps.

---

## The Problem

Google Maps stops working the moment you walk inside a building. It can tell you which building your class is in — but not which floor, which corridor, or which door. For multi-storey college campuses with complex layouts, ramps, and wings where floor numbers don't even match between sides, this is a genuine daily problem.

No existing navigation product solves this for college campuses specifically.

---

## What CampusNav Does

CampusNav is a B2B SaaS platform that provides complete indoor campus navigation for colleges. Each college onboards through an admin panel, maps their campus once, and students get real-time turn-by-turn directions to any classroom — including full vertical navigation across floors, staircases, lifts, and ramps.

Not a static map. Actual navigation. Like Google Maps, but complete.

---

## How It Works

### Outdoor Positioning — GPS
Standard location services handles outdoor and open area positioning exactly like Google Maps. Nothing exotic.

### Indoor Positioning — Dead Reckoning (Sensor Fusion)
Once inside a building, GPS weakens. CampusNav switches to dead reckoning — continuously calculating position from movement using the sensors already in every smartphone:

```
Pedometer      → counts steps, estimates distance travelled
Accelerometer  → detects movement patterns, stair climbing, lift motion
Gyroscope      → tracks direction changes and turns
Magnetometer   → absolute compass heading reference
Barometer      → confirms floor level via pressure signatures
```

Together these sensors provide continuous 3D position tracking indoors without any external hardware.

### Vertical Navigation — Transition Detection
Each vertical transition has a distinct sensor signature:

```
Stair climbing  → rhythmic vertical accelerometer pattern + step count + pressure rise
Stair descending → different rhythm + forward lean pattern + pressure drop
Lift ascending  → smooth vertical acceleration → sustained velocity → deceleration + pressure change
Ramp            → gradual consistent vertical acceleration + pressure gradient over distance
```

The app detects which transition type is happening, updates floor level accordingly, and announces it in the turn-by-turn instructions.

### Drift Correction — QR Anchors
Dead reckoning accumulates small errors over time. QR codes placed at key junctions around the campus act as ground truth anchors. When a user passes one, position snaps back to exact coordinates and drift resets to zero. Users don't need to scan every one — proximity detection handles it passively.

### Pathfinding — Node Graph + Dijkstra
The campus is modelled as a weighted graph:

```
Nodes  → classrooms, corridor junctions, staircases, lifts, ramps, exits
Edges  → corridors (weighted by distance/time), floor transitions (tagged by type)
```

Dijkstra's algorithm finds the shortest path. The app converts it to human-readable turn-by-turn instructions including floor transition announcements.

**Example output:**
```
"Walk straight 15 meters"
"Take the staircase on your right"
"You are now on Floor 2"
"Turn left"
"Lab 3 is 10 meters ahead on your right"
```

### AI Sensor Validator
An AI layer sits on top of the sensor pipeline — not touching navigation logic, only validating sensor sanity:

- Detects abnormal pressure readings (weather events, atmospheric changes)
- Identifies sensor conflicts (barometer says Floor 2, GPS says ground level)
- Distinguishes building anomalies from environmental events by comparing readings across active users
- Triggers graceful degradation when confidence is low

```
Normal confidence  → sensors pass to Dijkstra as usual
Low confidence     → "Floor detection unreliable right now.
                      Please scan a nearby QR to confirm your floor."
```

Each college feeds their own building profile during setup — known dead zones, atrium locations, lift shaft interference points — making the validator campus-aware, not generic.

---

## Sensor Fusion Summary

| Sensor | Role |
|---|---|
| GPS | Outdoor horizontal positioning |
| Pedometer | Indoor step counting and distance |
| Accelerometer | Movement pattern + transition detection |
| Gyroscope | Direction tracking and turns |
| Magnetometer | Absolute heading reference |
| Barometer | Floor level confirmation |
| QR Anchors | Drift correction ground truth |
| AI Validator | Sensor anomaly detection |

Each sensor covers the weakness of another. No single point of failure.

---

## Platform Architecture

CampusNav is built as a multi-tenant SaaS platform. Each college is an isolated tenant with their own campus data, node graph, floor profiles, and AI building profile.

```
┌──────────────────────────────────────────────────┐
│                 CampusNav Platform                │
├───────────────────┬──────────────────────────────┤
│   Admin Panel     │        Student App            │
│   (Web)           │        (Mobile)               │
│                   │                               │
│ College signs up  │  Student selects college      │
│ Maps campus       │  Sensor fusion locates user   │
│ Labels nodes      │  Dijkstra navigates           │
│ Feeds AI profile  │  Turn by turn directions      │
│ Publishes map     │  AI validates sensor health   │
└───────────────────┴──────────────────────────────┘
```

---

## Database Schema

```sql
colleges      (id, name, domain, location, created_at)
nodes         (id, college_id, label, type, floor, gps_lat, gps_lng, pressure_hpa)
edges         (id, college_id, node_from, node_to, distance_m, duration_s, type)
floor_maps    (id, college_id, floor_number, pressure_min, pressure_max, pressure_baseline)
building_profile (id, college_id, dead_zones, atrium_nodes, lift_shaft_nodes, region_baseline_pressure)
qr_anchors    (id, college_id, node_id, qr_code)

-- node types: classroom, lab, office, junction, staircase_bottom,
--             staircase_top, lift_ground, lift_upper, ramp_start, ramp_end, exit, restroom
-- edge types: corridor, stair, lift, ramp
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Student App | React Native |
| Admin Panel | React.js |
| Backend API | Node.js (Express) / Python (FastAPI) |
| Database | PostgreSQL |
| Maps | Mapbox (custom GeoJSON overlay) |
| Auth | Supabase Auth |
| Hosting | Railway (backend), Vercel (frontend) |
| Sensors | Device sensor suite via mobile SDK |
| AI Validator | LLM API (anomaly detection layer) |

---

## Campus Mapping Process

A one-time setup per college. Admin team walks the campus with the mapping tool open:

```
1. Stand at a classroom door
2. Tap "Place Node"
3. App records GPS + barometer reading + sensor context automatically
4. Label the node (e.g. "Room 301", "CS Lab 2", "Staircase B Top")
5. Connect to adjacent node, tag edge type
6. Mark known dead zones, atriums, lift shafts for AI profile
7. Place QR anchor codes at key junctions
8. Repeat for entire campus
```

Once mapped, the data is permanent and reusable. The AI building profile improves over time as more students use the app and sensor patterns accumulate.

---

## Known Limitations

- Dead reckoning drift accumulates over long walks — QR anchors mitigate this but don't eliminate it
- Accelerometer stair detection can fail on unusual staircase designs
- Barometer accuracy varies between phone models — relative pressure offsets used instead of absolute values
- Campus mapping requires a physical walkthrough — one time effort per college
- Complex split-level architecture requires careful node graph design during mapping
- AI validator requires minimum active users to detect campus-wide atmospheric events

---

## Roadmap

- [x] Architecture design and sensor fusion strategy
- [x] AI validator concept and campus profile design
- [ ] Backend API — college auth, node/edge CRUD, Dijkstra endpoint
- [ ] Admin panel — campus mapping tool, node editor, floor manager, AI profile builder
- [ ] Student app — college selector, sensor fusion positioning, navigation UI
- [ ] Dead reckoning engine — pedometer + gyroscope + accelerometer integration
- [ ] Barometer floor detection with relative pressure calibration
- [ ] Vertical transition detection — stairs, lift, ramp signatures
- [ ] QR anchor drift correction system
- [ ] AI sensor anomaly detection layer
- [ ] MEC campus mapped as proof of concept (Customer #1)
- [ ] Multi-college onboarding flow
- [ ] Accessibility features — audio turn-by-turn guidance
- [ ] Offline map caching

---

## Why This Exists

Every engineering college in India has this problem. The solution requires no special hardware — just the sensors already in every smartphone and a graph of the campus. CampusNav makes that accessible to any college through a simple onboarding process.

Built as a college project. Designed to scale.

---

## Team

Built for Project Jam, Model Engineering College — June 2026.

---

## License

MIT
