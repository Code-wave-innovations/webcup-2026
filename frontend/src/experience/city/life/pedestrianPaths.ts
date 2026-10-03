import { Vector3 } from 'three'
import { createRandom } from '../../../lib/random'
import { CITY_CENTER, CITY_SEED } from '../cityConfig'
import { relief } from '../layout/relief'
import { GroundPath } from './groundPath'

const TAU = Math.PI * 2
const WALKER_SEED = CITY_SEED + 191
const ANIMAL_SEED = CITY_SEED + 311
const AVENUES = 6
const AVENUE_INNER = 6
const AVENUE_OUTER = 31
const AVENUE_SAMPLES = 18

export interface Walker {
  readonly path: GroundPath
  distance: number
  speed: number
  phase: number
  readonly frequency: number
  readonly scale: number
  readonly seed: number
  readonly position: Vector3
  readonly forward: Vector3
}

export interface Animal {
  readonly homeX: number
  readonly homeZ: number
  readonly radius: number
  yaw: number
  turnIn: number
  phase: number
  readonly frequency: number
  readonly scale: number
  readonly seed: number
  readonly position: Vector3
  readonly forward: Vector3
}

const range = (random: () => number, min: number, max: number) => min + (max - min) * random()

const placeWalker = (walker: Walker) => {
  walker.path.sample(walker.distance, walker.position)
  walker.position.y = Math.max(relief(walker.position.x, walker.position.z), 0.2)
  walker.path.tangent(walker.distance, walker.forward)
  if (walker.speed < 0) walker.forward.multiplyScalar(-1)
}

function avenuePath(index: number): GroundPath | null {
  const angle = (TAU * index) / AVENUES
  const dx = Math.cos(angle)
  const dz = Math.sin(angle)
  const points: Vector3[] = []
  for (let i = 0; i < AVENUE_SAMPLES; i++) {
    const r = AVENUE_INNER + ((AVENUE_OUTER - AVENUE_INNER) * i) / (AVENUE_SAMPLES - 1)
    const x = CITY_CENTER.x + dx * r
    const z = CITY_CENTER.z + dz * r
    const y = relief(x, z)
    if (y < 0.55) continue
    points.push(new Vector3(x, y, z))
  }
  return points.length >= 2 ? new GroundPath(points, false) : null
}

/** The tree-lined approach from the bridge into the basin (same polyline the layout plants along). */
function corridorPath(): GroundPath {
  const points: Vector3[] = []
  for (let z = 6; z <= 30; z += 1.4) {
    const x = 0.42 * (31 - z) * 0.9
    const y = relief(x, z)
    if (y >= 0.55) points.push(new Vector3(x, y, z))
  }
  return new GroundPath(points, false)
}

function spawnWalkers(paths: readonly GroundPath[], count: number, random: () => number): Walker[] {
  const walkers: Walker[] = []
  let tries = 0
  while (walkers.length < count && tries++ < count * 8) {
    const path = paths[Math.floor(random() * paths.length)]
    const walker: Walker = {
      path,
      distance: random() * path.length,
      speed: range(random, 0.85, 1.45) * (random() < 0.5 ? -1 : 1),
      phase: random() * TAU,
      frequency: range(random, 1.55, 2.1),
      scale: range(random, 0.9, 1.12),
      seed: random(),
      position: new Vector3(),
      forward: new Vector3(0, 0, 1),
    }
    placeWalker(walker)
    if (walker.position.y < 0.55) continue
    walkers.push(walker)
  }
  return walkers
}

/** Residents walking the six radial avenues and the bridge approach. */
export function createWalkers(light: boolean): Walker[] {
  const random = createRandom(WALKER_SEED)
  const paths = [...Array.from({ length: AVENUES }, (_, i) => avenuePath(i)).filter((p): p is GroundPath => !!p), corridorPath()]
  return spawnWalkers(paths, light ? 36 : 70, random)
}

export function updateWalkers(walkers: readonly Walker[], dt: number): void {
  const step = Math.min(dt, 0.1)
  for (const walker of walkers) {
    const next = walker.path.advance(walker.distance, walker.speed, step)
    walker.distance = next.distance
    walker.speed = next.speed
    walker.phase = (walker.phase + TAU * walker.frequency * step) % TAU
    placeWalker(walker)
  }
}

/** Small animals wandering around the planted trees. `trees` is TREE_STRIDE (x, y, z, size, seed). */
export function createAnimals(trees: Float32Array, light: boolean): Animal[] {
  const random = createRandom(ANIMAL_SEED)
  const count = light ? 8 : 14
  const stride = 5
  const n = Math.floor(trees.length / stride)
  if (!n) return []
  const animals: Animal[] = []
  let i = Math.floor(random() * n)
  while (animals.length < count) {
    const k = (i % n) * stride
    i += 3 + Math.floor(random() * 5)
    const homeX = trees[k]
    const homeZ = trees[k + 2]
    const y = relief(homeX, homeZ)
    if (y < 0.7) continue
    const yaw = random() * TAU
    const animal: Animal = {
      homeX,
      homeZ,
      radius: 1.6 + random() * 1.8,
      yaw,
      turnIn: range(random, 0.6, 2.4),
      phase: random() * TAU,
      frequency: range(random, 2.2, 3.4),
      scale: range(random, 0.75, 1.15),
      seed: random(),
      position: new Vector3(homeX, y, homeZ),
      forward: new Vector3(Math.cos(yaw), 0, Math.sin(yaw)),
    }
    animals.push(animal)
    if (animals.length >= n) break
  }
  return animals
}

export function updateAnimals(animals: readonly Animal[], dt: number): void {
  const step = Math.min(dt, 0.1)
  for (const animal of animals) {
    animal.turnIn -= step
    if (animal.turnIn <= 0) {
      const n = Math.sin(animal.seed * 67.13 + animal.phase * 3.17) * 43758.5453
      const u = n - Math.floor(n)
      animal.yaw += (u - 0.5) * 1.8
      animal.turnIn = 0.8 + u * 2.2
    }
    const out = Math.hypot(animal.position.x - animal.homeX, animal.position.z - animal.homeZ)
    if (out > animal.radius) animal.yaw = Math.atan2(animal.homeZ - animal.position.z, animal.homeX - animal.position.x)
    const speed = 0.7 + 0.25 * Math.sin(animal.phase)
    animal.position.x += Math.cos(animal.yaw) * speed * step
    animal.position.z += Math.sin(animal.yaw) * speed * step
    animal.position.y = Math.max(relief(animal.position.x, animal.position.z), 0.2)
    animal.forward.set(Math.cos(animal.yaw), 0, Math.sin(animal.yaw))
    animal.phase = (animal.phase + TAU * animal.frequency * step) % TAU
  }
}
