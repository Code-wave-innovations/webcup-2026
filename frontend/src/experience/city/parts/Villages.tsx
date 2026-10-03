import { useMemo } from 'react'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { createRandom } from '../../../lib/random'
import { CITY_SEED, POIS, type POI } from '../cityConfig'
import { relief } from '../layout/relief'
import { useCity } from '../CityContext'
import { setSiteObstacles } from '../explore/exploreCollision'
import { createWorldMaterial } from '../worldMaterial'
import towerVert from '../glsl/tower.vert.glsl?raw'
import poiFrag from '../glsl/poi.frag.glsl?raw'

const VILLAGE_POIS = POIS.filter((p) => p.icon === 'village')
const SEED = CITY_SEED + 701
const HOUSES_PER_VILLAGE = 16
const HOUSE_WIDTH = [4, 6] as const
const HOUSE_DEPTH = [3.5, 5] as const
const HOUSE_WALL_H = [2.8, 3.6] as const
const ROOF_H = 1.8

const range = (random: () => number, min: number, max: number) => min + (max - min) * random()

/** Merge a box body + wedge roof into a single house geometry. */
function createHouseGeometry(): BufferGeometry {
  const body = new BoxGeometry(1, 1, 1)
  body.translate(0, 0.5, 0)
  // pitched roof: a flattened box rotated 45 degrees to form a ridge
  const roof = new BoxGeometry(1.15, 0.1, 1.15)
  roof.rotateZ(Math.PI / 4)
  roof.scale(1, 2.2, 0.85)
  roof.translate(0, 1.15, 0)
  // merge into one
  const merged = new BufferGeometry()
  const bPos = body.getAttribute('position')
  const rPos = roof.getAttribute('position')
  const bNorm = body.getAttribute('normal')
  const rNorm = roof.getAttribute('normal')
  const total = bPos.count + rPos.count
  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  positions.set(new Float32Array(bPos.array), 0)
  positions.set(new Float32Array(rPos.array), bPos.count * 3)
  normals.set(new Float32Array(bNorm.array), 0)
  normals.set(new Float32Array(rNorm.array), bNorm.count * 3)
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  // indices
  const bIdx = body.getIndex()!
  const rIdx = roof.getIndex()!
  const indices = new Uint16Array(bIdx.count + rIdx.count)
  for (let i = 0; i < bIdx.count; i++) indices[i] = bIdx.array[i]
  for (let i = 0; i < rIdx.count; i++) indices[bIdx.count + i] = rIdx.array[i] + bPos.count
  merged.setIndex(new BufferAttribute(indices, 1))
  body.dispose()
  roof.dispose()
  return merged
}

function placeVillage(poi: POI, random: () => number): Array<{ x: number; y: number; z: number; rot: number; w: number; d: number; h: number; seed: number }> {
  const houses: Array<{ x: number; y: number; z: number; rot: number; w: number; d: number; h: number; seed: number }> = []
  let tries = 0
  while (houses.length < HOUSES_PER_VILLAGE && tries++ < 200) {
    const angle = random() * Math.PI * 2
    // a square kept free in the middle (Nova lands there)
    const r = 7 + random() * (poi.radius - 9)
    const x = poi.x + Math.cos(angle) * r
    const z = poi.z + Math.sin(angle) * r
    const y = Math.max(relief(x, z), 0)
    if (y < 0.3) continue
    const tooClose = houses.some((h) => Math.hypot(h.x - x, h.z - z) < 4.5)
    if (tooClose) continue
    houses.push({
      x, y, z,
      rot: angle + random() * 0.5,
      w: range(random, HOUSE_WIDTH[0], HOUSE_WIDTH[1]),
      d: range(random, HOUSE_DEPTH[0], HOUSE_DEPTH[1]),
      h: range(random, HOUSE_WALL_H[0], HOUSE_WALL_H[1]),
      seed: random(),
    })
  }
  return houses
}

/** Pretty villages: clusters of small houses with pitched roofs, scattered around each village POI. */
export function Villages() {
  const { uniforms } = useCity()

  const meshes = useMemo(() => {
    const random = createRandom(SEED)
    const villages = VILLAGE_POIS.map((poi) => ({ poi, houses: placeVillage(poi, random) }))
    // Nova walks around the houses and the camera stays out of them
    villages.forEach(({ poi, houses }) =>
      setSiteObstacles(
        poi.id,
        houses.map((h) => ({ x: h.x, z: h.z, halfX: h.w * 0.575, halfZ: h.d * 0.575, rotation: h.rot, top: h.y + h.h + ROOF_H })),
      ),
    )
    const allHouses = villages.flatMap((village) => village.houses)
    const count = allHouses.length

    const geo = createHouseGeometry()
    const mat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.65 },
      uEmis: { value: 0.0 },
    })
    const mesh = new InstancedMesh(geo, mat, count)
    const seeds = new Float32Array(count)
    const mat4 = new Matrix4()
    const quat = new Quaternion()
    const pos = new Vector3()
    const scl = new Vector3()
    const yAxis = new Vector3(0, 1, 0)

    allHouses.forEach((h, n) => {
      pos.set(h.x, h.y, h.z)
      scl.set(h.w, h.h + ROOF_H, h.d)
      mesh.setMatrixAt(n, mat4.compose(pos, quat.setFromAxisAngle(yAxis, h.rot), scl))
      seeds[n] = h.seed
    })
    geo.setAttribute('aGraine', new InstancedBufferAttribute(seeds, 1))
    mesh.frustumCulled = false

    // garden paths: flat stones between houses
    const pathGeo = new CylinderGeometry(0.8, 0.8, 0.05, 6)
    const pathMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.3 },
      uEmis: { value: 0.0 },
    })
    const pathCount = Math.min(count * 2, 60)
    const paths = new InstancedMesh(pathGeo, pathMat, pathCount)
    const identity = new Quaternion()
    const one = new Vector3(1, 1, 1)
    for (let i = 0; i < pathCount; i++) {
      const a = allHouses[i % count]
      const b = allHouses[(i + 1) % count]
      const mx = (a.x + b.x) / 2 + (random() - 0.5) * 2
      const mz = (a.z + b.z) / 2 + (random() - 0.5) * 2
      const my = Math.max(relief(mx, mz), 0)
      pos.set(mx, my + 0.025, mz)
      paths.setMatrixAt(i, mat4.compose(pos, identity, one))
    }
    paths.frustumCulled = false

    return { mesh, paths }
  }, [uniforms])

  return (
    <>
      <primitive object={meshes.mesh} />
      <primitive object={meshes.paths} />
    </>
  )
}
