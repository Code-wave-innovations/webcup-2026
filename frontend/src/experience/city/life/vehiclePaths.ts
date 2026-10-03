import { Vector3 } from 'three'
import { createRandom } from '../../../lib/random'
import { BRIDGE_PATH, CITY_CENTER, CITY_SEED, RING, ROAD_LIFT } from '../cityConfig'
import { GroundPath } from './groundPath'

const TAU = Math.PI * 2
const VEHICLE_SEED = CITY_SEED + 77
const RING_SAMPLES = 180
const RING_LANES = [-0.55, 0.55] as const
const BRIDGE_LANE = 0.7

export interface Vehicle {
  readonly path: GroundPath
  distance: number
  speed: number
  readonly lane: number
  readonly scale: number
  readonly seed: number
  readonly position: Vector3
  readonly forward: Vector3
}

const range = (random: () => number, min: number, max: number) => min + (max - min) * random()

function createRingPath(radius: number): GroundPath {
  const points: Vector3[] = []
  for (let i = 0; i < RING_SAMPLES; i++) {
    const a = (TAU * i) / RING_SAMPLES
    points.push(new Vector3(CITY_CENTER.x + Math.cos(a) * radius, RING.height + ROAD_LIFT, CITY_CENTER.z + Math.sin(a) * radius))
  }
  return new GroundPath(points, true)
}

/** Out along the bridge, back on a parallel lane: a closed circuit over the lake. */
function createBridgePath(): GroundPath {
  const outbound = BRIDGE_PATH.map(([x, y, z]) => new Vector3(x, y + ROAD_LIFT, z))
  const inbound: Vector3[] = []
  for (let i = outbound.length - 1; i >= 0; i--) {
    const prev = outbound[Math.min(i + 1, outbound.length - 1)]
    const next = outbound[Math.max(i - 1, 0)]
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    inbound.push(new Vector3(outbound[i].x + (tz / len) * BRIDGE_LANE * 2, outbound[i].y, outbound[i].z - (tx / len) * BRIDGE_LANE * 2))
  }
  return new GroundPath([...outbound, ...inbound], true)
}

const place = (vehicle: Vehicle, out = vehicle.position): Vector3 => {
  vehicle.path.sample(vehicle.distance, out)
  vehicle.path.tangent(vehicle.distance, vehicle.forward)
  const lx = -vehicle.forward.z
  const lz = vehicle.forward.x
  out.x += lx * vehicle.lane
  out.z += lz * vehicle.lane
  return out
}

function spawnOn(path: GroundPath, count: number, random: () => number, speed: readonly [number, number], lanes: readonly number[]): Vehicle[] {
  return Array.from({ length: count }, () => {
    const distance = random() * path.length
    const pace = range(random, speed[0], speed[1]) * (random() < 0.5 && lanes.length > 1 ? -1 : 1)
    const lane = lanes[Math.floor(random() * lanes.length)]
    const vehicle: Vehicle = {
      path,
      distance,
      speed: pace,
      // oncoming traffic drives on the mirrored lane
      lane: pace < 0 ? -lane : lane,
      scale: range(random, 0.88, 1.14),
      seed: random(),
      position: new Vector3(),
      forward: new Vector3(0, 0, 1),
    }
    place(vehicle)
    return vehicle
  })
}

/** Cars of the ring road and the bridge, seeded so the traffic is the same every visit. */
export function createTraffic(light: boolean): Vehicle[] {
  const random = createRandom(VEHICLE_SEED)
  const ring = createRingPath(RING.radius)
  const bridge = createBridgePath()
  return [
    ...spawnOn(ring, light ? 15 : 30, random, [6.2, 9.4], RING_LANES),
    ...spawnOn(bridge, light ? 4 : 8, random, [7.5, 11], [BRIDGE_LANE, -BRIDGE_LANE]),
  ]
}

/** Advances every vehicle along its road and writes the world pose the shader reads. */
export function updateTraffic(vehicles: readonly Vehicle[], dt: number): void {
  const step = Math.min(dt, 0.1)
  for (const vehicle of vehicles) {
    const next = vehicle.path.advance(vehicle.distance, vehicle.speed, step)
    vehicle.distance = next.distance
    vehicle.speed = next.speed
    place(vehicle)
  }
}
