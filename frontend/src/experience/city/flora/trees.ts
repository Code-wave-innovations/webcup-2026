import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createWorldMaterial, type WorldUniforms } from '../worldMaterial'
import treeVert from '../glsl/tree.vert.glsl?raw'
import treeFrag from '../glsl/tree.frag.glsl?raw'

/** One tree to plant: ground position, total height, crown width relative to the height, seed (colour, sway). */
export interface TreeSpec {
  x: number
  y: number
  z: number
  height: number
  seed: number
  conifer: boolean
  /** crown width multiplier, 1 = the species' natural shape */
  spread?: number
}

/** Small deterministic noise for bumping the crowns (no Math.random: the same tree every visit). */
const bump = (x: number, y: number, z: number) => Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5 + Math.sin(x * 4.1 - z * 5.3 + y * 7.7) * 0.5

/** Tags a part: `aBois` 1 on the trunk, `aOcc` the ambient occlusion (0 deep inside the crown → 1 outside). */
function tag(geometry: BufferGeometry, wood: number, occlusion: (p: Vector3) => number): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  flat.deleteAttribute('uv')
  const position = flat.getAttribute('position')
  const woods = new Float32Array(position.count).fill(wood)
  const occ = new Float32Array(position.count)
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) occ[i] = occlusion(p.fromBufferAttribute(position, i))
  flat.setAttribute('aBois', new BufferAttribute(woods, 1))
  flat.setAttribute('aOcc', new BufferAttribute(occ, 1))
  return flat
}

/**
 * A foliage lobe: a bumped icosahedron whose normals point away from the crown's centre, so the whole crown is lit
 * like one soft mass of leaves instead of facets.
 */
function lobe(radius: number, x: number, y: number, z: number, crown: Vector3, crownRadius: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(radius, 2)
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const p = new Vector3()
  const n = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    const k = 1 + 0.16 * bump(p.x / radius + x, p.y / radius + y, p.z / radius + z)
    p.multiplyScalar(k).add(new Vector3(x, y, z))
    position.setXYZ(i, p.x, p.y, p.z)
    n.copy(p).sub(crown).normalize()
    normal.setXYZ(i, n.x, n.y, n.z)
  }
  return tag(geometry, 0, (q) => Math.min(1, 0.25 + 0.75 * (q.distanceTo(crown) / crownRadius)))
}

/** A broadleaf tree one unit tall, base at the origin: a tapered trunk with two limbs and a crown of four lobes. */
function broadleafGeometry(): BufferGeometry {
  const trunk = new CylinderGeometry(0.028, 0.05, 0.5, 7, 1)
  trunk.translate(0, 0.25, 0)
  const limbA = new CylinderGeometry(0.012, 0.022, 0.24, 5, 1)
  limbA.translate(0, 0.12, 0)
  limbA.rotateZ(-0.7)
  limbA.translate(0, 0.42, 0)
  const limbB = new CylinderGeometry(0.012, 0.02, 0.22, 5, 1)
  limbB.translate(0, 0.11, 0)
  limbB.rotateX(0.75)
  limbB.translate(0, 0.44, 0)
  const crown = new Vector3(0, 0.7, 0)
  const parts = [
    tag(trunk, 1, () => 0.55),
    tag(limbA, 1, () => 0.4),
    tag(limbB, 1, () => 0.4),
    lobe(0.24, 0, 0.7, 0, crown, 0.32),
    lobe(0.18, 0.16, 0.62, 0.04, crown, 0.32),
    lobe(0.17, -0.13, 0.64, -0.09, crown, 0.32),
    lobe(0.16, 0.03, 0.86, 0.04, crown, 0.32),
    lobe(0.14, -0.04, 0.6, 0.16, crown, 0.32),
  ]
  return normalised(parts)
}

/** A conifer one unit tall: a short trunk under five stacked, slightly drooping cones. */
function coniferGeometry(): BufferGeometry {
  const trunk = new CylinderGeometry(0.02, 0.04, 0.3, 6, 1)
  trunk.translate(0, 0.15, 0)
  const parts = [tag(trunk, 1, () => 0.45)]
  const tiers = [
    { y: 0.14, h: 0.34, r: 0.27 },
    { y: 0.3, h: 0.3, r: 0.22 },
    { y: 0.45, h: 0.27, r: 0.17 },
    { y: 0.6, h: 0.24, r: 0.12 },
    { y: 0.74, h: 0.26, r: 0.07 },
  ]
  for (const tier of tiers) {
    const cone = new ConeGeometry(tier.r, tier.h, 11, 2, true)
    const position = cone.getAttribute('position')
    const p = new Vector3()
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i)
      // ragged, drooping skirt
      const skirt = p.y < 0 ? 1 + 0.18 * bump(p.x * 9, tier.y, p.z * 9) : 1
      position.setXYZ(i, p.x * skirt, p.y - (p.y < 0 ? 0.03 * Math.abs(bump(p.z * 7, 1, p.x * 7)) : 0), p.z * skirt)
    }
    cone.computeVertexNormals()
    cone.translate(0, tier.y + tier.h / 2, 0)
    parts.push(tag(cone, 0, (q) => Math.min(1, 0.3 + 0.7 * (Math.hypot(q.x, q.z) / tier.r))))
  }
  return normalised(parts)
}

/** Merges the parts and rescales them so the tree is exactly one unit tall. */
function normalised(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  merged.computeBoundingBox()
  const top = merged.boundingBox!.max.y
  merged.scale(1 / top, 1 / top, 1 / top)
  merged.computeBoundingSphere()
  return merged
}

/**
 * Plants trees as two instanced draws (broadleaf and conifer). Each instance is scaled to its height, turned at
 * random and given its seed (leaf colour, wind phase).
 */
export function createTreeMeshes(uniforms: WorldUniforms, trees: readonly TreeSpec[]): InstancedMesh[] {
  const material = createWorldMaterial(uniforms, treeVert, treeFrag)
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const position = new Vector3()
  const scale = new Vector3()
  const up = new Vector3(0, 1, 0)
  const meshes: InstancedMesh[] = []
  for (const conifer of [false, true]) {
    const group = trees.filter((tree) => tree.conifer === conifer)
    if (group.length === 0) continue
    const geometry = conifer ? coniferGeometry() : broadleafGeometry()
    const mesh = new InstancedMesh(geometry, material, group.length)
    const seeds = new Float32Array(group.length)
    group.forEach((tree, n) => {
      const width = tree.height * (tree.spread ?? 1) * (0.9 + 0.2 * tree.seed)
      // planted a little into the ground so slopes never show a floating root
      position.set(tree.x, tree.y - tree.height * 0.02, tree.z)
      scale.set(width, tree.height, width)
      mesh.setMatrixAt(n, matrix.compose(position, rotation.setFromAxisAngle(up, tree.seed * 40), scale))
      seeds[n] = tree.seed
    })
    geometry.setAttribute('aGraine', new InstancedBufferAttribute(seeds, 1))
    mesh.frustumCulled = false
    meshes.push(mesh)
  }
  return meshes
}

export function disposeTreeMeshes(meshes: InstancedMesh[]): void {
  meshes.forEach((mesh) => mesh.geometry.dispose())
  ;(meshes[0]?.material as { dispose(): void } | undefined)?.dispose()
}
