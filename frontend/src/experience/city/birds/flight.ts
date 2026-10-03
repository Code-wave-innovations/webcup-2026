import { Vector3 } from 'three'
import { clamp, damp, smoothstep } from '../../../lib/math'
import { createRandom } from '../../../lib/random'
import { CITY_CENTER, CITY_SEED, OBSERVATORY } from '../cityConfig'
import type { Tower } from '../layout/generateCity'
import { relief } from '../layout/relief'
import { SPECIES, type SpeciesId } from './species'

const TAU = Math.PI * 2
const BIRD_SEED = CITY_SEED + 404
/** a coordinated turn banks by atan(v·ω / g): this "g" sets how steeply the birds lean into their turns */
const BANK_GRAVITY = 4
const MAX_BANK = 1.15
/** steepest climb or dive of the body, as the vertical component of its heading */
const MAX_PITCH = 0.45
/** time step of the finite difference giving the velocity of birds that follow authored paths */
const PATH_DT = 0.05
/** frames longer than this (a hidden tab) are clamped so the flocks do not scatter */
const MAX_FRAME = 0.1

/** One bird, as the shaders need it. */
export interface Bird {
  readonly position: Vector3
  readonly velocity: Vector3
  /** where the body points: the velocity, smoothed and with its climb limited (unit) */
  readonly forward: Vector3
  /** unsmoothed direction of flight at the last frame, to measure the turn rate */
  readonly heading: Vector3
  /** roll into the turn, radians (> 0 leans towards the bird's right, +x) */
  bank: number
  /** wingbeat cycle, radians */
  phase: number
  /** wingbeat amplitude: 0 gliding → 1 flapping */
  flap: number
  /** individual size around the species' wingspan */
  readonly scale: number
  readonly frequency: number
  readonly seed: number
}

export interface Flock {
  readonly species: SpeciesId
  readonly birds: readonly Bird[]
  update(dt: number, time: number): void
}

export interface Aviary {
  readonly flocks: readonly Flock[]
  birdsOf(species: SpeciesId): Bird[]
  /** where insects swarm: the swallows drift there (null: they tour the city on their own) */
  lure(point: Vector3 | null): void
  update(dt: number, time: number): void
}

type Random = () => number
type PathFn = (time: number, out: Vector3) => Vector3

const range = (random: Random, min: number, max: number) => min + (max - min) * random()
const wrapAngle = (a: number) => a - TAU * Math.round(a / TAU)

function createBird(species: SpeciesId, random: Random, frequency = SPECIES[species].frequency * range(random, 0.92, 1.08)): Bird {
  return {
    position: new Vector3(),
    velocity: new Vector3(),
    forward: new Vector3(0, 0, 1),
    heading: new Vector3(0, 0, 1),
    bank: 0,
    phase: random() * TAU,
    flap: 0,
    scale: range(random, 0.88, 1.12),
    frequency,
    seed: random(),
  }
}

const direction = new Vector3()

/** Unit direction of the velocity, its climb limited (keeps the current heading when hovering or rising straight up). */
function flightDirection(bird: Bird): Vector3 {
  const v = bird.velocity
  const level = Math.hypot(v.x, v.z)
  if (level < 1e-3) return direction.copy(bird.heading)
  const y = clamp(v.y / Math.hypot(level, v.y), -MAX_PITCH, MAX_PITCH)
  const k = Math.sqrt(1 - y * y) / level
  return direction.set(v.x * k, y, v.z * k)
}

/** Snaps the body onto its direction of flight (first frame). */
function aim(bird: Bird): void {
  const d = flightDirection(bird)
  bird.heading.copy(d)
  bird.forward.copy(d)
}

/** Points the body along its flight and rolls it into the turn, measured from the change of heading. */
function orient(bird: Bird, dt: number): void {
  if (dt <= 0) return
  const d = flightDirection(bird)
  const last = bird.heading
  const turn = Math.atan2(last.z * d.x - last.x * d.z, last.x * d.x + last.z * d.z) / dt
  last.copy(d)
  const bank = clamp(Math.atan((bird.velocity.length() * turn) / BANK_GRAVITY), -MAX_BANK, MAX_BANK)
  bird.bank += (bank - bird.bank) * damp(4, dt)
  bird.forward.lerp(d, damp(10, dt)).normalize()
}

/** Advances the wingbeat; the amplitude eases in and out so a glide starts and ends smoothly. */
function beat(bird: Bird, dt: number, flapping: boolean): void {
  bird.phase = (bird.phase + TAU * bird.frequency * dt) % TAU
  bird.flap += ((flapping ? 1 : 0) - bird.flap) * damp(flapping ? 7 : 3.5, dt)
}

const behind = new Vector3()

/** Places a bird on an authored path at `time`, its velocity from a fixed-step finite difference. */
function followPath(bird: Bird, path: PathFn, time: number, dt: number): void {
  path(time, bird.position)
  path(time - PATH_DT, behind)
  bird.velocity.subVectors(bird.position, behind).divideScalar(PATH_DT)
  if (dt > 0) orient(bird, dt)
  else aim(bird)
}

/** Alternates bursts of wingbeats and glides, the flap-gliding of most birds. */
class FlapRhythm {
  private readonly random: Random
  private readonly beats: readonly [number, number]
  private readonly glide: readonly [number, number]
  private readonly frequency: number
  private flapping: boolean
  private left: number

  constructor(random: Random, beats: readonly [number, number], glide: readonly [number, number], frequency: number) {
    this.random = random
    this.beats = beats
    this.glide = glide
    this.frequency = frequency
    this.flapping = random() < 0.5
    this.left = random() * this.duration()
  }

  private duration(): number {
    return this.flapping ? range(this.random, ...this.beats) / this.frequency : range(this.random, ...this.glide)
  }

  /** True while flapping. */
  next(dt: number): boolean {
    this.left -= dt
    if (this.left <= 0) {
      this.flapping = !this.flapping
      this.left = this.duration()
    }
    return this.flapping
  }
}

// ==========================================
// Eagles: soaring in thermals
// ==========================================

interface Thermal {
  x: number
  z: number
  radius: number
  altitude: number
}

const THERMALS: readonly Thermal[] = [
  // over the lake, in the opening view
  { x: 10, z: 66, radius: 16, altitude: 30 },
  // around the council tower
  { x: -4, z: -10, radius: 13, altitude: 50 },
  // beside the Observatory
  { x: 15, z: -9, radius: 9, altitude: 44 },
]
/** how far the centre of a thermal drifts, and how much its circle breathes */
const THERMAL_DRIFT = 6
const THERMAL_BREATH = 0.16

/** Lowest safe altitude for a circle: above every tower standing in the ring it sweeps. */
function thermalAltitude(thermal: Thermal, towers: readonly Tower[]): number {
  const inner = thermal.radius * (1 - THERMAL_BREATH) - THERMAL_DRIFT - 3
  const outer = thermal.radius * (1 + THERMAL_BREATH) + THERMAL_DRIFT + 3
  let altitude = thermal.altitude
  for (const t of towers) {
    const d = Math.hypot(t.x - thermal.x, t.z - thermal.z)
    if (d > inner - t.width && d < outer + t.width) altitude = Math.max(altitude, t.height + 6)
  }
  return altitude
}

interface Circle extends Thermal {
  /** -1 clockwise, 1 anticlockwise */
  turn: number
  start: number
  seed: number
}

/** Eagles circling in rising air: wide banked turns, drifting with the thermal, a few wingbeats now and then. */
class ThermalSoarers implements Flock {
  readonly species: SpeciesId = 'eagle'
  readonly birds: Bird[]
  private readonly circles: Circle[]
  private readonly rhythms: FlapRhythm[]

  constructor(random: Random, thermals: readonly Thermal[], towers: readonly Tower[]) {
    this.circles = thermals.map((t) => ({
      ...t,
      altitude: thermalAltitude(t, towers),
      turn: random() < 0.5 ? -1 : 1,
      start: random() * TAU,
      seed: random(),
    }))
    this.birds = this.circles.map(() => createBird('eagle', random))
    this.rhythms = this.birds.map((b) => new FlapRhythm(random, [2, 4], [9, 22], b.frequency))
    this.circles.forEach((c, i) => followPath(this.birds[i], (t, out) => this.at(c, t, out), 0, 0))
  }

  private at(c: Circle, time: number, out: Vector3): Vector3 {
    const radius = c.radius * (1 + THERMAL_BREATH * Math.sin(time * 0.07 + c.seed * 5))
    const angle = c.start + (c.turn * SPECIES.eagle.speed * time) / c.radius
    return out.set(
      c.x + THERMAL_DRIFT * Math.sin(time * 0.031 + c.seed * 9) + Math.cos(angle) * radius,
      c.altitude + 4 * Math.sin(time * 0.045 + c.seed * 11),
      c.z + THERMAL_DRIFT * Math.cos(time * 0.023 + c.seed * 7) + Math.sin(angle) * radius,
    )
  }

  update(dt: number, time: number): void {
    this.circles.forEach((c, i) => {
      const bird = this.birds[i]
      followPath(bird, (t, out) => this.at(c, t, out), time, dt)
      beat(bird, dt, this.rhythms[i].next(dt))
    })
  }
}

// ==========================================
// Geese: skeins in V formation
// ==========================================

interface SkeinRoute {
  x: number
  z: number
  radiusX: number
  radiusZ: number
  altitude: number
  birds: number
}

const SKEINS: readonly SkeinRoute[] = [
  // across the valley and the lake, in front of the opening and closing views
  { x: 4, z: 70, radiusX: 45, radiusZ: 50, altitude: 24, birds: 9 },
  // far away over the northern mountains, a small V against the sky
  { x: -20, z: -120, radiusX: 170, radiusZ: 70, altitude: 70, birds: 7 },
]
const PATH_SAMPLES = 1440
/** height kept above the relief */
const PATH_CLEARANCE = 12
/** steepest climb of a skein (rise over run): geese climb over a ridge gradually, from far ahead */
const PATH_GRADE = 0.1
/** half-width, in samples, of the smoothing that rounds the start and end of the climbs */
const PATH_SMOOTHING = 20
/** formation spacing: behind and beside the bird ahead, in world units (half-angle of the V ≈ 35°) */
const V_ALONG = 1.05
const V_LATERAL = 0.75
/** half-length of the stretch of path the formation's direction is measured over (smooths the turns of the V) */
const V_TANGENT = 4

/** A closed loop over the landscape, resampled by arc length, lifted (smoothly) above the relief. */
class ClosedPath {
  readonly length: number
  private readonly points: Float32Array
  private readonly distances: Float32Array

  constructor(route: SkeinRoute) {
    const n = PATH_SAMPLES
    const points = new Float32Array((n + 1) * 3)
    const floor = new Float32Array(n)
    let heights = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = (TAU * i) / n
      const x = route.x + route.radiusX * (Math.sin(u) + 0.1 * Math.sin(2 * u + 0.7))
      const z = route.z + route.radiusZ * (Math.cos(u) + 0.08 * Math.sin(3 * u + 0.4))
      floor[i] = Math.max(relief(x, z), 0) + PATH_CLEARANCE
      heights[i] = Math.max(route.altitude, floor[i])
      points[i * 3] = x
      points[i * 3 + 2] = z
    }
    // limit the grade: walking the loop both ways, each sample is raised to within reach of its neighbours
    for (let pass = 0; pass < 2; pass++) {
      for (const step of [1, -1]) {
        for (let k = 0; k < n * 2; k++) {
          const i = (((step > 0 ? k : -k) % n) + n) % n
          const j = (i - step + n) % n
          const run = Math.hypot(points[i * 3] - points[j * 3], points[i * 3 + 2] - points[j * 3 + 2])
          heights[i] = Math.max(heights[i], heights[j] - run * PATH_GRADE)
        }
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      const next = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        let sum = 0
        for (let k = -PATH_SMOOTHING; k <= PATH_SMOOTHING; k++) sum += heights[(i + k + n) % n]
        next[i] = sum / (2 * PATH_SMOOTHING + 1)
      }
      heights = next
    }
    for (let i = 0; i < n; i++) points[i * 3 + 1] = Math.max(heights[i], floor[i] - PATH_CLEARANCE * 0.4)
    points.copyWithin(n * 3, 0, 3)
    const distances = new Float32Array(n + 1)
    for (let i = 1; i <= n; i++) {
      const dx = points[i * 3] - points[i * 3 - 3]
      const dy = points[i * 3 + 1] - points[i * 3 - 2]
      const dz = points[i * 3 + 2] - points[i * 3 - 1]
      distances[i] = distances[i - 1] + Math.hypot(dx, dy, dz)
    }
    this.points = points
    this.distances = distances
    this.length = distances[n]
  }

  /** The point `distance` along the loop (wraps around). */
  sample(distance: number, out: Vector3): Vector3 {
    const d = ((distance % this.length) + this.length) % this.length
    let low = 0
    let high = PATH_SAMPLES
    while (high - low > 1) {
      const mid = (low + high) >> 1
      if (this.distances[mid] <= d) low = mid
      else high = mid
    }
    const t = (d - this.distances[low]) / (this.distances[high] - this.distances[low])
    const p = this.points
    return out.set(
      p[low * 3] + (p[high * 3] - p[low * 3]) * t,
      p[low * 3 + 1] + (p[high * 3 + 1] - p[low * 3 + 1]) * t,
      p[low * 3 + 2] + (p[high * 3 + 2] - p[low * 3 + 2]) * t,
    )
  }
}

interface Slot {
  rank: number
  /** -1 left arm, 1 right arm, 0 leader */
  side: number
  /** fixed irregularity of the place in the V */
  along: number
  seed: number
}

/** A skein of geese: the leader follows a loop, the others hold their place in the V, always adjusting it a little. */
class Skein implements Flock {
  readonly species: SpeciesId = 'goose'
  readonly birds: Bird[]
  private readonly path: ClosedPath
  private readonly slots: Slot[]
  private readonly start: number
  private readonly ahead = new Vector3()
  private readonly back = new Vector3()

  constructor(random: Random, route: SkeinRoute) {
    this.path = new ClosedPath(route)
    this.start = random() * this.path.length
    // followers alternate between the arms; their places are slightly irregular (`along`), as in real skeins
    this.slots = Array.from({ length: route.birds }, (_, k) => {
      const side = k === 0 ? 0 : k % 2 ? -1 : 1
      return { rank: Math.ceil(k / 2), side, along: k ? (random() - 0.5) * 0.3 : 0, seed: random() }
    })
    // the skein beats at one rhythm, a wave running down each arm
    const frequency = SPECIES.goose.frequency * range(random, 0.95, 1.05)
    this.birds = this.slots.map((slot) => {
      const bird = createBird('goose', random, frequency * range(random, 0.99, 1.01))
      bird.phase = slot.rank * 0.8 + random() * 0.4
      return bird
    })
    this.slots.forEach((slot, i) => followPath(this.birds[i], (t, out) => this.at(slot, t, out), 0, 0))
  }

  private at(slot: Slot, time: number, out: Vector3): Vector3 {
    const d = this.start + SPECIES.goose.speed * time - slot.rank * V_ALONG + slot.along + 0.15 * Math.sin(time * 0.6 + slot.seed * 7)
    this.path.sample(d, out)
    const ahead = this.path.sample(d + V_TANGENT, this.ahead)
    const back = this.path.sample(d - V_TANGENT, this.back)
    const dx = ahead.x - back.x
    const dz = ahead.z - back.z
    const length = Math.hypot(dx, dz) || 1
    const lateral = slot.side * slot.rank * V_LATERAL + 0.18 * Math.sin(time * 0.8 + slot.seed * 20)
    out.x += (dz / length) * lateral
    out.z -= (dx / length) * lateral
    out.y += 0.15 * Math.sin(time * 1.1 + slot.seed * 13)
    return out
  }

  update(dt: number, time: number): void {
    this.slots.forEach((slot, i) => {
      const bird = this.birds[i]
      followPath(bird, (t, out) => this.at(slot, t, out), time, dt)
      beat(bird, dt, true)
    })
  }
}

// ==========================================
// Gulls: gliding low over the lake
// ==========================================

/** the lake and the mouth of the river (see relief.ts) */
const LAKE = { x: 4, z: 72, radiusX: 46, radiusZ: 40 } as const
/** fastest turn of a gull, rad/s (banks it by about 50°) */
const GULL_TURN = 0.9

interface Wander {
  yaw: number
  phases: [number, number, number]
  rates: [number, number]
}

/** Gulls wandering over the water: long glides on bent wings, lazy turns, a few beats to climb back. */
class LakeGulls implements Flock {
  readonly species: SpeciesId = 'gull'
  readonly birds: Bird[]
  private readonly wanders: Wander[]
  private readonly rhythms: FlapRhythm[]

  constructor(random: Random, count: number) {
    this.birds = Array.from({ length: count }, () => createBird('gull', random))
    this.wanders = this.birds.map((bird) => {
      const angle = random() * TAU
      const r = Math.sqrt(random()) * 0.6
      bird.position.set(LAKE.x + Math.cos(angle) * r * LAKE.radiusX, 7 + random() * 6, LAKE.z + Math.sin(angle) * r * LAKE.radiusZ)
      const yaw = random() * TAU
      bird.velocity.set(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(SPECIES.gull.speed)
      aim(bird)
      return { yaw, phases: [random() * TAU, random() * TAU, random() * TAU], rates: [range(random, 0.8, 1.2), range(random, 0.8, 1.2)] }
    })
    this.rhythms = this.birds.map((b) => new FlapRhythm(random, [3, 7], [2, 6], b.frequency))
  }

  update(dt: number, time: number): void {
    this.birds.forEach((bird, i) => {
      const w = this.wanders[i]
      const p = bird.position
      let turn = 0.32 * Math.sin(time * 0.21 * w.rates[0] + w.phases[0]) + 0.22 * Math.sin(time * 0.57 * w.rates[1] + w.phases[1])
      // back towards the middle of the lake near its shores
      const out = Math.hypot((p.x - LAKE.x) / LAKE.radiusX, (p.z - LAKE.z) / LAKE.radiusZ)
      const home = Math.atan2(LAKE.z - p.z, LAKE.x - p.x)
      turn += wrapAngle(home - w.yaw) * 1.4 * smoothstep(0.7, 1.05, out)
      w.yaw += clamp(turn, -GULL_TURN, GULL_TURN) * dt
      const speed = SPECIES.gull.speed * (1 + 0.12 * Math.sin(time * 0.3 + w.phases[2]))
      const ground = Math.max(relief(p.x, p.z), 0)
      const cruise = Math.max(ground + 3.5, 8 + 4 * Math.sin(time * 0.11 * w.rates[0] + w.phases[2]))
      const climb = clamp((cruise - p.y) * 0.6, -1.8, 1.8)
      bird.velocity.set(Math.cos(w.yaw) * speed, climb, Math.sin(w.yaw) * speed)
      p.addScaledVector(bird.velocity, dt)
      orient(bird, dt)
      beat(bird, dt, this.rhythms[i].next(dt) || climb > 1)
    })
  }
}

// ==========================================
// Swallows: a darting flock among the towers
// ==========================================

const SWARM = {
  neighbourhood: 5,
  personalSpace: 2.2,
  /** each swallow hunts its own patch around the focus: the flock stays loose */
  patch: 7,
  /** above the low-rise roofs (up to about 7) */
  floor: 9,
  ceiling: 30,
  minSpeed: 7,
  maxSpeed: 13,
  maxAcceleration: 22,
  /** sub-step of the boids integration */
  step: 1 / 45,
  /** how far from the city centre, and how high, the lure can take the flock */
  reach: 42,
  lureFloor: 13,
  lureCeiling: 24,
  /** speed at which the hunting ground moves towards the lure */
  migration: 9,
  /** steering gain towards the focus, and the distance under which the flock slows down to it */
  seek: 0.9,
  arrival: 14,
} as const

interface Obstacle {
  x: number
  z: number
  radius: number
  top: number
}

interface Dart {
  /** counts down to the next dart; the dart lasts while it is between -DART_TIME and 0 */
  timer: number
  x: number
  z: number
  /** phases and rates of the bird's own patch around the focus */
  patch: [number, number, number, number]
}
const DART_TIME = 0.3
const DART_FORCE = 14

/**
 * Swallows hawking for insects over the city: a boids flock (separation, alignment, cohesion) chasing a
 * focus that wanders around its hunting ground, steering around the towers, each bird darting aside now
 * and then. The hunting ground tours the districts, or drifts towards a lure (where the camera looks).
 */
class SwallowSwarm implements Flock {
  readonly species: SpeciesId = 'swallow'
  readonly birds: Bird[]
  private readonly obstacles: Obstacle[]
  private readonly darts: Dart[]
  private readonly rhythms: FlapRhythm[]
  private readonly random: Random
  private readonly accelerations: Vector3[]
  private readonly ground = new Vector3(CITY_CENTER.x, 16, CITY_CENTER.z)
  private readonly target = new Vector3()
  private readonly focus = new Vector3()
  private readonly sum = new Vector3()
  private readonly centre = new Vector3()
  private readonly away = new Vector3()
  private lurePoint: Vector3 | null = null

  constructor(random: Random, count: number, towers: readonly Tower[]) {
    this.random = random
    this.obstacles = towers
      .filter((t) => t.height > SWARM.floor - 2)
      .map((t) => ({ x: t.x, z: t.z, radius: t.width * 0.55, top: t.height + 0.5 }))
    this.obstacles.push({ x: OBSERVATORY.x, z: OBSERVATORY.z, radius: OBSERVATORY.radius, top: OBSERVATORY.h + 3 })
    this.moveGround(0, 0)
    this.focusAt(0)
    this.birds = Array.from({ length: count }, () => {
      const bird = createBird('swallow', random)
      bird.position.set(range(random, -6, 6), range(random, -3, 3), range(random, -6, 6)).add(this.focus)
      const yaw = random() * TAU
      bird.velocity.set(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(SPECIES.swallow.speed)
      aim(bird)
      return bird
    })
    this.darts = this.birds.map(() => ({
      timer: range(random, 0.5, 4),
      x: 0,
      z: 0,
      patch: [random() * TAU, random() * TAU, range(random, 0.15, 0.35), range(random, 0.15, 0.35)],
    }))
    this.rhythms = this.birds.map((b) => new FlapRhythm(random, [3, 8], [0.25, 0.8], b.frequency))
    this.accelerations = this.birds.map(() => new Vector3())
  }

  lure(point: Vector3 | null): void {
    this.lurePoint = point
  }

  /** Moves the hunting ground towards the lure (kept over the city, under the tall towers' tops), at a bird's pace. */
  private moveGround(dt: number, time: number): void {
    const target = this.target
    if (this.lurePoint) target.copy(this.lurePoint)
    else target.set(CITY_CENTER.x + 26 * Math.sin(time * 0.061), 16, CITY_CENTER.z + 20 * Math.sin(time * 0.097 + 1.3))
    const dx = target.x - CITY_CENTER.x
    const dz = target.z - CITY_CENTER.z
    const r = Math.hypot(dx, dz)
    if (r > SWARM.reach) target.set(CITY_CENTER.x + (dx / r) * SWARM.reach, target.y, CITY_CENTER.z + (dz / r) * SWARM.reach)
    target.y = clamp(target.y, SWARM.lureFloor, SWARM.lureCeiling)
    if (dt <= 0) {
      this.ground.copy(target)
      return
    }
    const gap = target.sub(this.ground)
    this.ground.addScaledVector(gap.clampLength(0, SWARM.migration * dt), 1)
  }

  /** The flock's focus: wandering around the hunting ground. */
  private focusAt(time: number): Vector3 {
    return this.focus.set(8 * Math.sin(time * 0.31), 3 * Math.sin(time * 0.47), 8 * Math.sin(time * 0.23 + 1.3)).add(this.ground)
  }

  update(dt: number, time: number): void {
    this.moveGround(dt, time)
    const steps = Math.max(1, Math.ceil(dt / SWARM.step))
    const h = dt / steps
    for (let s = 0; s < steps; s++) this.step(h, time - dt + (s + 1) * h)
    this.birds.forEach((bird, i) => {
      orient(bird, dt)
      beat(bird, dt, this.rhythms[i].next(dt))
    })
  }

  private step(dt: number, time: number): void {
    if (dt <= 0) return
    const focus = this.focusAt(time)
    this.birds.forEach((bird, i) => {
      const p = bird.position
      const a = this.accelerations[i].set(0, 0, 0)
      const sum = this.sum.set(0, 0, 0)
      const centre = this.centre.set(0, 0, 0)
      let neighbours = 0
      for (const other of this.birds) {
        if (other === bird) continue
        const d = p.distanceTo(other.position)
        if (d > SWARM.neighbourhood) continue
        neighbours++
        sum.add(other.velocity)
        centre.add(other.position)
        if (d < SWARM.personalSpace) a.addScaledVector(this.away.subVectors(p, other.position), 2.5 / (d * d + 0.05))
      }
      if (neighbours) {
        a.addScaledVector(sum.divideScalar(neighbours).sub(bird.velocity), 0.8)
        a.addScaledVector(centre.divideScalar(neighbours).sub(p), 0.3)
      }
      // seek and arrive: steer towards a velocity aimed at the bird's patch, slower when close (no pendulum swings)
      const [u, v, ru, rv] = this.darts[i].patch
      const toFocus = this.away.set(
        SWARM.patch * Math.sin(time * ru + u),
        SWARM.patch * 0.4 * Math.sin(time * rv + v),
        SWARM.patch * Math.cos(time * rv + u),
      ).add(focus).sub(p)
      const distance = toFocus.length()
      if (distance > 1e-3) {
        toFocus.multiplyScalar((SWARM.maxSpeed * clamp(distance / SWARM.arrival, 0.35, 1)) / distance).sub(bird.velocity)
        a.addScaledVector(toFocus, SWARM.seek)
      }
      if (p.y < SWARM.floor) a.y += (SWARM.floor - p.y) * 6
      if (p.y > SWARM.ceiling) a.y -= (p.y - SWARM.ceiling) * 4
      for (const o of this.obstacles) {
        if (p.y > o.top + 2) continue
        const dx = p.x - o.x
        const dz = p.z - o.z
        const d = Math.hypot(dx, dz) || 1e-3
        const margin = o.radius + 3 - d
        if (margin > 0) {
          a.x += (dx / d) * margin * 6
          a.z += (dz / d) * margin * 6
        }
      }
      const dart = this.darts[i]
      dart.timer -= dt
      if (dart.timer < -DART_TIME) {
        dart.timer = range(this.random, 1, 4)
        const angle = this.random() * TAU
        dart.x = Math.cos(angle)
        dart.z = Math.sin(angle)
      } else if (dart.timer < 0) {
        a.x += dart.x * DART_FORCE
        a.z += dart.z * DART_FORCE
      }
      a.clampLength(0, SWARM.maxAcceleration)
    })
    this.birds.forEach((bird, i) => {
      const v = bird.velocity.addScaledVector(this.accelerations[i], dt)
      v.y = clamp(v.y, -4, 4)
      v.clampLength(SWARM.minSpeed, SWARM.maxSpeed)
      bird.position.addScaledVector(v, dt)
    })
  }
}

// ==========================================
// The aviary
// ==========================================

/** Every bird of the city, seeded (same flight every visit). Light devices get fewer. */
export function createAviary(towers: readonly Tower[], light: boolean): Aviary {
  const random = createRandom(BIRD_SEED)
  const swallows = new SwallowSwarm(random, light ? 12 : 22, towers)
  const flocks: Flock[] = [
    new ThermalSoarers(random, light ? THERMALS.slice(0, 2) : THERMALS, towers),
    ...(light ? SKEINS.slice(0, 1) : SKEINS).map((route) => new Skein(random, light ? { ...route, birds: 7 } : route)),
    new LakeGulls(random, light ? 3 : 5),
    swallows,
  ]
  return {
    flocks,
    birdsOf: (species) => flocks.filter((f) => f.species === species).flatMap((f) => [...f.birds]),
    lure: (point) => swallows.lure(point),
    update(dt, time) {
      const step = clamp(dt, 0, MAX_FRAME)
      for (const flock of flocks) flock.update(step, time)
    },
  }
}
