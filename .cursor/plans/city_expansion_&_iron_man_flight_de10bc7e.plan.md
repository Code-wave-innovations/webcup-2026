---
name: City Expansion & Iron Man Flight
overview: Rebuild the bridge and ring road into realistic elevated highways with flat decks, side barriers, and thick pillars. Expand the city with recreational POI areas (golf course, football stadium, villages), add an Iron Man-style flight animation for Nova, and tune proportions for ground-level realism.
todos:
  - id: realistic-roads
    content: "Rebuild Roads.tsx: replace TubeGeometry/TorusGeometry pipes with flat deck geometry (6m wide, 0.8m thick) + side barriers + thick pillars; update road GLSL shaders for lane markings and median"
    status: completed
  - id: poi-geography
    content: Define POI interface + POIS constant in cityConfig.ts; flatten terrain at POI sites in relief.ts; expand PLAY boundary in exploreCollision.ts
    status: completed
  - id: poi-geometry
    content: Create GolfCourse.tsx, Stadium.tsx, Villages.tsx with instanced geometry using createWorldMaterial; mount them in CityStage.tsx
    status: completed
  - id: trees-proportions
    content: Add suburban trees in generateCity.ts (radius 45-100); scale up tree crowns in Greenery.tsx; tune low-rise heights for ground-level realism
    status: completed
  - id: flight-system
    content: Add FlightArc to FilmDirector; create flightPath.ts (Bezier arc + flight camera); update CityStage.tsx camera blend; add flight pose in NovaActor.tsx
    status: completed
  - id: flight-trail
    content: "Create FlightTrail.tsx: ribbon geometry with additive ice-blue emissive shader, updated per frame during flight"
    status: completed
  - id: flight-hud
    content: Add POI selector buttons to ExploreHud.tsx; add flight/landing Nova lines in scenes.ts; add POI icons in Icon.tsx
    status: completed
  - id: flight-tests
    content: Write flightPath.test.ts (arc computation, position sampling, duration); update exploreCollision.test.ts for wider boundary
    status: completed
isProject: false
---

# City Expansion, Iron Man Flight & Realistic Proportions

## Current State

The city is a ~70m diameter basin (`CITY_RADIUS = 33`, ring road at 35) with towers, domes, low-rise blocks, trees, and an elevated bridge over the lake. The explore boundary is `PLAY = 48` world units from center. Beyond that: mountains via `relief()` (fbm + ridges), lake/river to the south. 1 world unit ~= 1 meter. Nova is 1.7m (`WORLD_SCALE = 1.7`).

**Proportions problem at ground level:** trees are only ~1.5m tall (bushes!), low-rise blocks max ~5m, ring road tube is 84cm radius. The flyover view was designed first; walking among these looks miniature.

---

## Part 0: Realistic Bridge & Ring Road

The bridge and ring road are the most visible infrastructure when walking. Currently they are **TubeGeometry / TorusGeometry with 0.42 radius** (84cm pipe) and **0.34m box pillars** -- pipes on sticks, not real roads.

### 0.1. Flat deck geometry helper -- `createDeckGeometry()`

Add a reusable function in [`Roads.tsx`](frontend/src/experience/city/parts/Roads.tsx) (or a separate `roadGeometry.ts`):

```typescript
function createDeckGeometry(
  curve: Curve<Vector3>,
  width: number,     // 6m (two lanes + shoulders)
  thickness: number, // 0.8m
  segments: number,
): BufferGeometry
```

- Sample the curve at `segments+1` points
- At each sample: compute tangent, bitangent (cross with up), normal
- Build a rectangular cross-section: 4 corners per sample (top-left, top-right, bottom-left, bottom-right)
- Create indexed faces for top, bottom, two sides
- UV mapping: `u = arcLength / totalLength` (same as current `vUv.x * uLongueur` so the road shader keeps working), `v` across the width
- For the ring road: construct a `CatmullRomCurve3` from sampled circle points (replacing `TorusGeometry`)

### 0.2. Side barriers -- instanced thin walls

Two barrier walls along each edge of the deck:
- Width 0.15m, height 1.1m, spaced along the curve
- Instanced boxes (`InstancedMesh`) positioned at deck-edge + barrier-half-width, rotated to face the tangent
- Same `plainFrag` material as the current pillars (dark concrete)
- ~120 barrier segments per road (ring + bridge)

### 0.3. Realistic pillars

Replace `BoxGeometry(0.34, 1, 0.34)` with proper columns:
- **Shape**: `CylinderGeometry(0.5, 0.7, 1, 8)` -- tapered, 1.0-1.4m diameter
- **T-cap**: a wider box on top (2.5m wide, 0.4m tall) connecting to the deck underside
- Merge column + cap into one geometry per pillar, or use two instanced draws
- Keep `RING_PILLARS = 40`, `BRIDGE_PILLARS = 25` (enough density)

### 0.4. Update `cityConfig.ts` road dimensions

Change `RING.tube` to a semantic name or add new fields:

```typescript
export const RING = { radius: 35, height: 3.7, tube: 0.42, deckWidth: 6, deckThick: 0.8 } as const
```

### 0.5. Update `road.frag.glsl` for lane markings

The shader already uses `vUv.x * uLongueur` as distance along the road and `N.y` to detect the top surface (`dessus`). Enhance the top surface with:
- **Center median**: dashed white line at `vUv.y ~= 0.5` (every 3m, 1m gap)
- **Edge lines**: solid white lines at `vUv.y ~= 0.08` and `~= 0.92`
- **Road surface**: slightly lighter asphalt color on top vs dark sides
- Keep the existing beacon lights on the side faces and the animated traffic lights on the deck

### 0.6. Update `road.vert.glsl`

Pass `vUv` (already done) -- no change needed if the deck geometry UV maps correctly.

### 0.7. Update vehicle paths

The vehicles in [`vehiclePaths.ts`](frontend/src/experience/city/life/vehiclePaths.ts) drive on the ring (circle at `RING.radius`) and bridge. The ring path is a parametric circle -- its Y should match `RING.height + deckThick/2` (top of the deck, not center of the old tube). The bridge path samples `CatmullRomCurve3` -- same adjustment. Vehicles should also be offset slightly left/right of center to simulate two lanes.

---

## Part A: POI Geography & Terrain

### A1. Define POI landmarks in [`cityConfig.ts`](frontend/src/experience/city/cityConfig.ts)

Add a `POI` interface and `POIS` constant with 4 areas placed in the foothills (radius 50-80), avoiding the lake (south/z > 50):

- **Golf Course** (`golf`): ~(-55, -50), flat radius 18 -- northwest, on dry hillside
- **Stadium** (`stade`): ~(60, 15), flat radius 14 -- east, near dome 3
- **East Village** (`village-est`): ~(50, -55), flat radius 12 -- southeast high ground
- **North Village** (`village-nord`): ~(-20, -65), flat radius 10 -- north

Each POI has: `id`, `name`, `icon`, `x`, `z`, `flatRadius`, `groundLevel`.

### A2. Flatten terrain at POI sites in [`relief.ts`](frontend/src/experience/city/layout/relief.ts)

Add a final pass in `relief()`: for each POI, `smoothstep` the computed height towards `poi.groundLevel` within `poi.flatRadius`, with a soft 8-unit transition edge. This ensures flat walkable ground at each landmark without changing the rest of the landscape.

### A3. Expand explore boundary in [`exploreCollision.ts`](frontend/src/experience/city/explore/exploreCollision.ts)

Increase `PLAY` from 48 to ~120. Add the POI flat zones as walkable circles. The `blocked()` check stays: water, towers, domes, low-rise blocks still block, but the outer boundary is wider and POI areas are explicitly reachable.

---

## Part B: POI Geometry (New Components)

### B1. `GolfCourse.tsx` -- instanced greens, bunkers, flags

- 9 "holes": instanced green discs (flattened cylinders, grass-colored world material)
- Sand bunkers: tan-tinted instanced low cylinders
- Flags: thin `CylinderGeometry` poles with small triangle meshes on top
- A clubhouse: a single box with a pitched-roof shape (merged geometry)
- Trees scattered around fairways (reuse `Greenery` pattern)
- All placed deterministically from `CITY_SEED` within the POI flat zone

### B2. `Stadium.tsx` -- oval stands, field markings, floodlights

- Stands: a `TorusGeometry` (oval, flattened) or instanced curved boxes forming an oval ring, ~60m x 40m
- Field: a flat green plane with white line markings (painted in the fragment shader, like the road markings)
- 4 floodlight poles at corners: tall thin cylinders with emissive tops (glow at night via `uNuit`)
- Scoreboard: a flat box with emissive face

### B3. `Villages.tsx` -- clusters of small houses with gardens

- Per village: 12-20 small houses (instanced boxes with pitched roofs via merged geometry: box body + wedge roof)
- Each house: 4-6m wide, 3-4m tall, warm earth tones (vary hue per instance seed)
- Small garden fences (instanced thin boxes)
- Winding paths between houses (low flat boxes, stone-colored)
- Trees interspersed (feed positions into the existing tree system or add a local set)
- All use `createWorldMaterial` with the existing `world.glsl` lighting

### B4. Mount POI geometry in [`CityStage.tsx`](frontend/src/experience/city/CityStage.tsx)

Add `<GolfCourse />`, `<Stadium />`, `<Villages />` as siblings of `<Greenery />`, `<CityLife />`, etc. They read `useCity()` for uniforms and only render when the quality tier allows (skip on `light`? Or always render since they are few instances).

---

## Part C: Expanded Trees & Suburban Greenery

### C1. More trees in `generateCity.ts`

Extend `plantTrees()` to scatter an additional ~80-150 trees in the radius 45-100 band, avoiding POI flat zones (golf has its own trees), water, and steep slopes (`relief > 0.7`, slope check via neighbor samples). These suburban trees should be larger (size 1.5-3.0) to look like proper trees at ground level.

### C2. Proportions tune-up

- **Trees**: increase the base crown scale. Currently `IcosahedronGeometry(0.5, 1)` with size 0.7-1.3, tall 1.15-1.65 -> crown tops at ~2m. Change: base geometry radius to 1.0, position crown center at `size * tall + 0.5`, making trees 3-8m tall. Adjust in [`Greenery.tsx`](frontend/src/experience/city/parts/Greenery.tsx) matrix composition.
- **Low-rise blocks**: boost the height multiplier slightly for suburban blocks (currently `* 0.7`), make them 2-4 stories. Change in `buildLowRise()`.
- The **ring road** tube (0.42) is fine from the air but looks like a pipe from the ground. Add a flat deck surface on top: a thin instanced box strip at `RING.height` (or widen the tube to 1.2). This is optional/stretch.

---

## Part D: Iron Man Flight System (the "wow" feature)

### D1. Flight state in [`FilmDirector.ts`](frontend/src/experience/director/FilmDirector.ts)

Add a new sub-state alongside `exploreGoal/exploreBlend`:

```typescript
export interface FlightArc {
  from: Vector3        // takeoff position
  to: Vector3          // landing position
  apex: number         // peak altitude (max of from.y, to.y + 30-50)
  duration: number     // total flight time (2.5-4s based on distance)
  elapsed: number      // current time
  phase: 'takeoff' | 'cruise' | 'land'
}
```

- `flightArc: FlightArc | null` on the director
- `flyTo(poi: POI)` method: computes the arc (cubic Bezier: P0=from, P1=from+up, P2=to+up, P3=to), sets `flightArc`, keeps `phase = 'explore'` (or adds `'flight'` to `FilmPhase`)
- `tick()` advances `flightArc.elapsed`, computes Nova's position along the Bezier, updates `roam.nova` position
- When `elapsed >= duration`: clear `flightArc`, snap Nova to ground at destination, resume walk mode

### D2. Flight path & camera in new `flightPath.ts`

```
frontend/src/experience/city/explore/flightPath.ts
```

- `computeFlightArc(from, to): FlightArc` -- distance-based duration (speed ~40 m/s), apex = max(from.y, to.y) + 25 + distance*0.15
- `sampleFlightPosition(arc, t): Vector3` -- cubic Bezier evaluation at t in [0,1]
- `sampleFlightCamera(arc, t, nova): ExploreView` -- camera trails 12 units behind Nova along the path tangent, 5 units above, looking ahead. Smooth ease-in on takeoff, ease-out on landing.
- Nova yaw: face the tangent direction of the Bezier

### D3. Flight camera blend in [`CityStage.tsx`](frontend/src/experience/city/CityStage.tsx)

During flight, replace the explore camera sample with the flight camera sample. The `exploreBlend` stays at 1 (we are still "on the ground" logically). The flight camera seamlessly transitions from the explore camera at takeoff and back at landing.

### D4. Nova flight pose in [`NovaActor.tsx`](frontend/src/experience/nova/stage/NovaActor.tsx)

During flight:
- Hold `brace` animation (arms back) -- already exists in the rig
- Tilt Nova forward ~30deg around the lateral axis (lean into the flight)
- `speed` set to a high value so walk animation plays fast (or override with the `brace` hold)

### D5. Flight trail effect -- `FlightTrail.tsx`

A simple ribbon/streak behind Nova during flight:
- Use a `BufferGeometry` with ~60 vertices forming a ribbon
- Each frame: shift all positions back, add Nova's current position at the head
- Material: additive blending, ice-blue emissive (`--color-ice`), opacity fading from 1.0 at head to 0 at tail
- Use `createWorldMaterial` or a simple `ShaderMaterial` with `transparent: true`, `depthWrite: false`, `blending: AdditiveBlending`
- Dispose when flight ends (or hide with `visible = false`)

The trail is the key visual that makes it feel "Iron Man" -- a glowing streak across the sky.

### D6. Takeoff/landing particles (optional polish)

- On takeoff: burst of ~20 small particles expanding from Nova's feet (dust cloud)
- On landing: same burst at the destination
- Reuse the instanced particle pattern from `Birds.tsx` with a short lifetime

---

## Part E: Flight HUD

### E1. POI selector in [`ExploreHud.tsx`](frontend/src/experience/city/explore/ExploreHud.tsx)

When exploring (not flying), show a row of POI buttons above the "Reprendre le survol" button:
- Each button: glass panel (same style as `.enter`), icon + name
- On click: call `director.flyTo(poi)` + `novaScenes.flyToPoi(poi.name)`
- During flight: hide POI buttons, show a "En vol vers [name]..." label with a small progress indicator
- On landing: show POI buttons again + Nova says arrival line

### E2. New Nova scenes in [`scenes.ts`](frontend/src/experience/nova/behavior/scenes.ts)

- `flyToPoi(name)`: Nova says "On y va !" + `brace` hold
- `landAtPoi(name)`: Nova says "Voila, [name] !" + `celebrate` gesture

### E3. New icons in [`Icon.tsx`](frontend/src/ui/Icon.tsx)

Add `golf`, `stadium`, `village` SVG path icons for the POI buttons.

---

## Part F: Wiring & Integration

### F1. Generate POI data in `generateCity.ts`

Add a `pois` field to `CityData` carrying the computed layout for each POI (house positions for villages, hole positions for golf, etc.), generated deterministically from `CITY_SEED`. This data flows through `CityContext` to the POI components.

### F2. Collision for POIs in `exploreCollision.ts`

Add POI-specific obstacles:
- Stadium stands: a ring of boxes
- Village houses: small discs
- Golf clubhouse: a disc
- Keep the POI interiors walkable (Nova walks on the golf fairways, through village streets, on the stadium field)

### F3. Update `directorStore.ts`

If adding `'flight'` as a `FilmPhase`, update the type. Or keep flight as a sub-state of `'explore'` (simpler: `director.flightArc !== null` while `phase === 'explore'`). Recommended: keep it as a sub-state to avoid changing every phase check.

---

## File Summary

**New files:**
- `frontend/src/experience/city/explore/flightPath.ts` -- Bezier arc computation + flight camera
- `frontend/src/experience/city/explore/FlightTrail.tsx` -- ribbon trail effect
- `frontend/src/experience/city/parts/GolfCourse.tsx` -- golf course geometry
- `frontend/src/experience/city/parts/Stadium.tsx` -- stadium geometry
- `frontend/src/experience/city/parts/Villages.tsx` -- village clusters
- `frontend/src/experience/city/explore/flightPath.test.ts` -- flight arc tests

**Modified files:**
- `Roads.tsx` -- replace pipe geometry with flat deck + barriers + thick pillars
- `road.frag.glsl` -- lane markings (median, edge lines) on the deck surface
- `cityConfig.ts` -- POI definitions + road deck dimensions
- `vehiclePaths.ts` -- adjust vehicle Y to deck surface, two-lane offset
- `relief.ts` -- flatten terrain at POI sites
- `generateCity.ts` -- suburban trees, POI layout data
- `Greenery.tsx` -- larger tree crowns
- `exploreCollision.ts` -- wider boundary, POI obstacles
- `FilmDirector.ts` -- `FlightArc`, `flyTo()`, flight tick
- `CityStage.tsx` -- flight camera blend, mount POI components
- `NovaActor.tsx` -- flight pose (tilt + brace)
- `ExploreHud.tsx` + `.module.css` -- POI buttons, flight status
- `scenes.ts` -- flight/landing Nova lines
- `Icon.tsx` -- POI icons
