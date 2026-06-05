# IndoorNav 🧭

> Turn-by-turn indoor navigation for any large venue — real-time 3D positioning across floors, corridors, staircases, lifts, and ramps. Built as a B2B SaaS platform for malls, universities, hospitals, airports, warehouses, and more.

---
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/34c0d50e-8c6e-45a1-af64-a092ff8489e1" />


## The Problem

Google Maps stops working the moment you walk inside a building. It can tell you which building you're looking for — but not which floor, which corridor, or which door. For large, multi-storey venues with complex layouts, wings, and split levels, this is a genuine daily problem for millions of people:

- **Shoppers** lost in sprawling malls, unable to find a store or the nearest restroom.
- **Students** navigating massive university campuses across buildings, floors, and wings.
- **Patients and visitors** struggling to find departments, wards, or labs inside hospitals.
- **Travellers** missing connections in airports because they can't find their gate.
- **Warehouse workers** wasting time locating inventory across vast facilities.

No existing navigation product solves indoor wayfinding as a turnkey, venue-agnostic platform.

---

## What IndoorNav Does

IndoorNav is a **B2B SaaS platform** that provides complete indoor navigation for any large venue. A venue operator onboards through an admin panel, maps their facility once, and end users get real-time turn-by-turn directions to any destination — including full vertical navigation across floors, staircases, lifts, and ramps.

Not a static map. Actual navigation. Like Google Maps, but for indoors.

### Who It's For

| Industry | Use Case |
|---|---|
| 🏬 **Malls & Retail** | Navigate to stores, food courts, restrooms, parking levels |
| 🎓 **Universities** | Find classrooms, labs, offices across multi-building campuses |
| 🏥 **Hospitals** | Guide patients to departments, wards, pharmacies, labs |
| ✈️ **Airports** | Gate-to-gate navigation, lounge finding, terminal transfers |
| 🏭 **Warehouses & Factories** | Inventory location, zone navigation, safety route guidance |
| 🏛️ **Convention Centers & Museums** | Exhibit finding, event hall navigation, booth location |
| 🏢 **Corporate Campuses** | Meeting room navigation, visitor wayfinding |

---

## How It Works

### Outdoor Positioning — GPS
Standard location services handle outdoor and open area positioning exactly like Google Maps. Nothing exotic.

### Indoor Positioning — Dead Reckoning (Sensor Fusion)
Once inside a building, GPS weakens. IndoorNav switches to dead reckoning — continuously calculating position from movement using the sensors already in every smartphone:

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
Stair climbing   → rhythmic vertical accelerometer pattern + step count + pressure rise
Stair descending → different rhythm + forward lean pattern + pressure drop
Lift ascending   → smooth vertical acceleration → sustained velocity → deceleration + pressure change
Ramp             → gradual consistent vertical acceleration + pressure gradient over distance
Escalator        → passive vertical movement + characteristic vibration pattern
```

The app detects which transition type is happening, updates floor level accordingly, and announces it in the turn-by-turn instructions.

### Drift Correction — QR Anchors
Dead reckoning accumulates small errors over time. QR codes placed at key junctions around the venue act as ground truth anchors. When a user passes one, position snaps back to exact coordinates and drift resets to zero. Users don't need to scan every one — proximity detection handles it passively.

### Pathfinding — Client-Side Dijkstra
The venue is modelled as a weighted graph:

```
Nodes  → destinations, corridor junctions, staircases, lifts, ramps, exits, restrooms
Edges  → corridors (weighted by distance/time), floor transitions (tagged by type)
```

Dijkstra's algorithm runs **on-device** (not server-side) for zero-latency routing and full offline support. The venue graph is small enough (typically a few hundred nodes) to compute instantly on any modern phone. The app converts the shortest path into human-readable turn-by-turn instructions including floor transition announcements.

**Example output (Hospital):**
```
"Walk straight 20 meters past Reception"
"Take the lift to Floor 3"
"You are now on Floor 3 — Cardiology Wing"
"Turn right"
"Dr. Sharma's Office is 15 meters ahead on your left"
```

**Example output (Mall):**
```
"Head towards the central atrium"
"Take the escalator to Level 2"
"You are now on Level 2"
"Turn left past Starbucks"
"Zara is 30 meters ahead on your right"
```

### AI Sensor Validator (On-Device)
A lightweight **rule-based engine + statistical model** runs on-device on top of the sensor pipeline — not touching navigation logic, only validating sensor sanity. No LLM or cloud AI calls needed for real-time sensor checks:

- Detects abnormal pressure readings (weather events, HVAC interference, atmospheric changes)
- Identifies sensor conflicts (barometer says Floor 2, GPS says ground level)
- Distinguishes building anomalies from environmental events by comparing readings across active users
- Triggers graceful degradation when confidence is low

```
Normal confidence  → sensors pass to Dijkstra as usual
Low confidence     → "Floor detection unreliable right now.
                      Please scan a nearby QR to confirm your floor."
```

Each venue feeds their own building profile during setup — known dead zones, atrium locations, lift shaft interference points, HVAC vents — making the validator venue-aware, not generic. Complex edge cases (building profile analysis, cross-venue pattern learning) are handled by a server-side Supabase Edge Function.

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
| AI Validator (On-Device) | Sensor anomaly detection — rule engine, no cloud dependency |

Each sensor covers the weakness of another. No single point of failure.

---

## Platform Architecture

IndoorNav is built as a **multi-tenant SaaS platform** powered by **Supabase** as the unified backend. Each venue is an isolated tenant with their own facility data, node graph, floor profiles, and AI building profile.

```
┌─────────────────────────────────────────────────────────────────┐
│                      IndoorNav Platform                         │
├─────────────────────┬───────────────────────────────────────────┤
│   Admin Panel       │           End User App                    │
│   (React + Vite)    │           (Expo / React Native)           │
│   Hosted on Vercel  │           iOS + Android                   │
│                     │                                           │
│ Venue signs up      │  User selects venue                       │
│ Maps facility       │  Downloads venue graph for offline use    │
│ Labels nodes        │  Sensor fusion locates user (on-device)   │
│ Feeds AI profile    │  Client-side Dijkstra navigates           │
│ Publishes map       │  On-device AI validates sensor health     │
├─────────────────────┴───────────────────────────────────────────┤
│                     Supabase (Backend)                          │
│  PostgreSQL │ Auth │ Edge Functions │ Realtime │ Storage        │
└─────────────────────────────────────────────────────────────────┘
```

### Why Supabase as the Full Backend?
Instead of running a separate Express/FastAPI server on Railway, Supabase provides everything in one platform:
- **PostgreSQL** — the graph database (nodes, edges, venues, organisations)
- **Auth** — venue admin login, end user auth, role-based access
- **Edge Functions** — API endpoints (venue CRUD, analytics, complex AI edge cases)
- **Realtime** — live position sharing, crowd density updates
- **Storage** — floor plan images, venue assets

This eliminates the need for a separate backend server, simplifies deployment, and reduces infrastructure cost.

### Multi-Venue Management
Enterprise clients (e.g. a hospital chain or mall group) can manage multiple venues from a single admin account, with shared branding and centralised analytics.

---

## Database Schema

```sql
organisations (id, name, type, domain, plan, created_at)
venues        (id, org_id, name, type, address, gps_lat, gps_lng, created_at)
nodes         (id, venue_id, label, type, floor, gps_lat, gps_lng, pressure_hpa)
edges         (id, venue_id, node_from, node_to, distance_m, duration_s, type)
floor_maps    (id, venue_id, floor_number, floor_label, pressure_min, pressure_max, pressure_baseline)
building_profile (id, venue_id, dead_zones, atrium_nodes, lift_shaft_nodes, hvac_zones, region_baseline_pressure)
qr_anchors    (id, venue_id, node_id, qr_code)

-- venue types:  mall, university, hospital, airport, warehouse, convention_center, corporate_campus, museum
-- node types:   room, store, office, department, ward, gate, junction, staircase_bottom,
--               staircase_top, lift_ground, lift_upper, ramp_start, ramp_end,
--               escalator_bottom, escalator_top, exit, restroom, parking
-- edge types:   corridor, stair, lift, ramp, escalator, walkway
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Mobile App** | React Native (Expo) | Cross-platform, built-in sensor APIs, fastest to ship |
| **Sensors** | `expo-sensors`, `expo-location`, `expo-barometric-pressure` | Accelerometer, gyroscope, magnetometer, barometer, pedometer — all accessible from JS |
| **QR Scanning** | `expo-camera` | Built-in barcode/QR support, no native code needed |
| **Indoor Maps** | Mapbox GL (`@rnmapbox/maps`) | Best indoor map overlay support, custom GeoJSON layers, React Native SDK |
| **Pathfinding** | Client-side Dijkstra (JavaScript) | Runs on-device — offline-capable, zero latency, instant re-routing |
| **Backend + DB + Auth** | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) | One platform replaces separate API server, database, and auth service |
| **Admin Panel** | React.js (Vite) | Web-based venue mapping tool, hosted on Vercel |
| **Hosting** | Vercel (admin panel) + Supabase (backend) | No separate server to manage |
| **AI Validator** | On-device rule engine + Supabase Edge Function fallback | Fast, cheap, no LLM needed for real-time sensor checks |

### Key Architectural Decisions

**Why Expo?** Expo provides out-of-the-box access to every sensor IndoorNav needs (`expo-sensors` covers accelerometer, gyroscope, magnetometer, barometer, and pedometer). No ejecting, no native module linking — the entire sensor fusion pipeline runs in JavaScript.

**Why client-side Dijkstra?** A venue graph is typically a few hundred nodes — trivial to compute on any modern phone. Running pathfinding on-device means navigation works even with zero network connectivity (critical inside buildings where signal is weak).

**Why Supabase instead of Express/FastAPI?** Supabase gives us PostgreSQL, Auth, Edge Functions, Realtime subscriptions, and file Storage in one managed platform. This eliminates the need to build, deploy, and maintain a separate API server — reducing infrastructure complexity from 3 services to 1.

**Why not Flutter or Native?** React Native (Expo) strikes the best balance for a project of this scope: single codebase, full sensor access, large ecosystem, and fastest path to a working prototype. Flutter is viable but requires learning Dart. Native (Swift + Kotlin) doubles the development effort.

---

## Venue Mapping Process

A one-time setup per venue. The admin team walks the facility with the mapping tool open:

```
1. Stand at a destination (store entrance, office door, department reception, gate, etc.)
2. Tap "Place Node"
3. App records GPS + barometer reading + sensor context automatically
4. Label the node (e.g. "Zara - Level 2", "Room 301", "Cardiology Reception", "Gate B7")
5. Connect to adjacent node, tag edge type
6. Mark known dead zones, atriums, lift shafts, HVAC zones for AI profile
7. Place QR anchor codes at key junctions
8. Repeat for entire venue
```

Once mapped, the data is permanent and reusable. The AI building profile improves over time as more users navigate and sensor patterns accumulate.

---

## Business Model

| Plan | Target | Features |
|---|---|---|
| **Starter** | Small venues, single buildings | 1 venue, up to 500 nodes, basic analytics |
| **Professional** | Mid-size venues, multi-floor | 5 venues, unlimited nodes, priority support, custom branding |
| **Enterprise** | Chains, campus networks, airports | Unlimited venues, API access, SSO, dedicated onboarding, SLA |

Revenue: recurring SaaS subscription per organisation.

---

## Known Limitations

- Dead reckoning drift accumulates over long walks — QR anchors mitigate this but don't eliminate it
- Accelerometer stair detection can fail on unusual staircase designs
- Barometer accuracy varies between phone models — relative pressure offsets used instead of absolute values
- Venue mapping requires a physical walkthrough — one-time effort per venue
- Complex split-level architecture requires careful node graph design during mapping
- AI validator requires minimum active users to detect venue-wide atmospheric events
- Very large venues (airports, mega-malls) benefit from denser QR anchor placement

---

## Roadmap

- [x] Architecture design and sensor fusion strategy
- [x] AI validator concept and building profile design
- [ ] Supabase setup — PostgreSQL schema, Auth config, Edge Functions, Row Level Security
- [ ] Admin panel (React + Vite) — venue mapping tool, node editor, floor manager, AI profile builder
- [ ] Mobile app (Expo) — venue selector, sensor fusion positioning, navigation UI
- [ ] Dead reckoning engine — pedometer + gyroscope + accelerometer integration
- [ ] Barometer floor detection with relative pressure calibration
- [ ] Vertical transition detection — stairs, lift, ramp, escalator signatures
- [ ] QR anchor drift correction system (`expo-camera`)
- [ ] On-device AI sensor anomaly detection (rule engine)
- [ ] Pilot venue mapped as proof of concept (Customer #1)
- [ ] Multi-venue onboarding flow
- [ ] Enterprise multi-venue management dashboard
- [ ] Accessibility features — audio turn-by-turn guidance, wheelchair-friendly routing
- [ ] Offline map caching
- [ ] Analytics dashboard — foot traffic heatmaps, popular routes, peak hours
- [ ] Public API for third-party integrations

---

## Why This Exists

Every large building has this problem — and the solution requires no special hardware. Just the sensors already in every smartphone and a graph of the venue. IndoorNav makes world-class indoor navigation accessible to any organisation through a simple onboarding process.

Built as a college project. Designed to scale as a platform.

---

## Team

Built for Project Jam, Model Engineering College — June 2026.

---


