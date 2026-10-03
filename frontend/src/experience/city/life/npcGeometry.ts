import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
} from 'three'
import { createWorldMaterial, type WorldUniforms } from '../worldMaterial'
import npcVert from '../glsl/npc.vert.glsl?raw'
import npcFrag from '../glsl/npc.frag.glsl?raw'

export const NPC_KIND = { vehicle: 0, pedestrian: 1, animal: 2 } as const

/** One instanced draw of city life: pose, heading and walk cycle written every frame. */
export interface NpcMesh {
  mesh: Mesh
  position: InstancedBufferAttribute
  heading: InstancedBufferAttribute
  anim: InstancedBufferAttribute
}

interface BoxPart {
  w: number
  h: number
  d: number
  x: number
  y: number
  z: number
}

/** Stylized ground car: a low body and a cabin, nose along +Z, wheels on the ground. */
export function createCarGeometry(): BufferGeometry {
  return mergeBoxes([
    { w: 0.92, h: 0.28, d: 2.15, x: 0, y: 0.26, z: 0 },
    { w: 0.8, h: 0.26, d: 1.05, x: 0, y: 0.5, z: -0.12 },
  ])
}

/** Standing figure, feet at y = 0. */
export function createPersonGeometry(): BufferGeometry {
  const geometry = new CapsuleGeometry(0.13, 0.95, 3, 7)
  geometry.translate(0, 0.605, 0)
  return geometry
}

/** Small four-legged silhouette, standing on y = 0, facing +Z. */
export function createAnimalGeometry(): BufferGeometry {
  return mergeBoxes([
    { w: 0.16, h: 0.14, d: 0.38, x: 0, y: 0.2, z: 0 },
    { w: 0.11, h: 0.1, d: 0.12, x: 0, y: 0.24, z: 0.22 },
    { w: 0.035, h: 0.12, d: 0.035, x: 0.05, y: 0.06, z: 0.12 },
    { w: 0.035, h: 0.12, d: 0.035, x: -0.05, y: 0.06, z: 0.12 },
    { w: 0.035, h: 0.12, d: 0.035, x: 0.05, y: 0.06, z: -0.12 },
    { w: 0.035, h: 0.12, d: 0.035, x: -0.05, y: 0.06, z: -0.12 },
  ])
}

export function createNpcMesh(source: BufferGeometry, uniforms: WorldUniforms, kind: number, count: number): NpcMesh {
  const n = Math.max(1, count)
  // a plain geometry has no instance count: copy it into an instanced one (one draw for every NPC)
  const geometry = new InstancedBufferGeometry().copy(source as InstancedBufferGeometry)
  source.dispose()
  geometry.instanceCount = count
  const attribute = () => new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage)
  const position = attribute()
  const heading = attribute()
  const anim = attribute()
  geometry.setAttribute('iPos', position)
  geometry.setAttribute('iDir', heading)
  geometry.setAttribute('iAnim', anim)
  const material = createWorldMaterial(uniforms, npcVert, npcFrag, { uKind: { value: kind } }, { side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, position, heading, anim }
}

export function disposeNpcMesh({ mesh }: NpcMesh): void {
  mesh.geometry.dispose()
  ;(mesh.material as { dispose: () => void }).dispose()
}

/** Writes one instance: world pose, facing, walk phase / bob, and a stable seed. */
export function writeNpc(mesh: NpcMesh, i: number, x: number, y: number, z: number, scale: number, fx: number, fy: number, fz: number, phase: number, bob: number, seed: number): void {
  const k = i * 4
  const p = mesh.position.array as Float32Array
  const h = mesh.heading.array as Float32Array
  const a = mesh.anim.array as Float32Array
  p[k] = x
  p[k + 1] = y
  p[k + 2] = z
  p[k + 3] = scale
  h[k] = fx
  h[k + 1] = fy
  h[k + 2] = fz
  h[k + 3] = 0
  a[k] = phase
  a[k + 1] = bob
  a[k + 2] = seed
}

export function markNpc(mesh: NpcMesh): void {
  mesh.position.needsUpdate = true
  mesh.heading.needsUpdate = true
  mesh.anim.needsUpdate = true
}

function mergeBoxes(boxes: readonly BoxPart[]): BufferGeometry {
  const parts = boxes.map(({ w, h, d, x, y, z }) => {
    const g = new BoxGeometry(w, h, d)
    g.translate(x, y, z)
    return g
  })
  const counts = parts.map((g) => g.getAttribute('position').count)
  const total = counts.reduce((sum, n) => sum + n, 0)
  const position = new Float32Array(total * 3)
  const normal = new Float32Array(total * 3)
  let offset = 0
  parts.forEach((g, i) => {
    position.set(g.getAttribute('position').array as Float32Array, offset * 3)
    normal.set(g.getAttribute('normal').array as Float32Array, offset * 3)
    offset += counts[i]
    g.dispose()
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  geometry.computeVertexNormals()
  return geometry
}
