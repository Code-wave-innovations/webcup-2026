import { useMemo } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { BRIDGE } from '../cityConfig'
import { useCity } from '../CityContext'
import { layoutBridge, type Member } from '../layout/bridgeLayout'
import { acrossOf, deckProfile, sweepProfile, type ProfilePoint } from '../layout/sweep'
import { createWorldMaterial } from '../worldMaterial'
import roadVert from '../glsl/road.vert.glsl?raw'
import roadFrag from '../glsl/road.frag.glsl?raw'
import towerVert from '../glsl/tower.vert.glsl?raw'
import bridgeFrag from '../glsl/bridge.frag.glsl?raw'
import lightsVert from '../glsl/lights.vert.glsl?raw'
import lightsFrag from '../glsl/lights.frag.glsl?raw'

const ROAD_EDGE = BRIDGE.roadHalf + BRIDGE.sidewalk
const POST_SPACING = 1.5
const RAIL_SEGMENTS = 420
const UP = new Vector3(0, 1, 0)

const _dir = new Vector3()
const _yaw = new Quaternion()
const _tilt = new Quaternion()
const _matrix = new Matrix4()
const _scale = new Vector3()

/**
 * Places a unit member (standing on y = 0, one unit tall) from `member.from` to `member.to`: its local x turned to
 * `across` first, then tilted onto the member, so square sections keep their faces along the bridge.
 */
function memberMatrix(member: Member, across: Vector3, width: number, depth: number): Matrix4 {
  _dir.subVectors(member.to, member.from)
  const length = _dir.length()
  _yaw.setFromAxisAngle(UP, Math.atan2(-across.z, across.x))
  _tilt.setFromUnitVectors(UP, _dir.normalize()).multiply(_yaw)
  return _matrix.compose(member.from, _tilt, _scale.set(width, length, depth))
}

function instanced(geometry: BufferGeometry, material: Material, matrices: Matrix4[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, matrices.length))
  mesh.count = matrices.length
  matrices.forEach((m, n) => mesh.setMatrixAt(n, m))
  mesh.frustumCulled = false
  return mesh
}

/** A thin rectangular rail, centred `b` across and `y` above the road. */
const railProfile = (b: number, y: number, w: number, h: number): ProfilePoint[] => [
  { b: b - w / 2, y, v: 0 },
  { b: b + w / 2, y, v: 0 },
  { b: b + w / 2, y: y + h, v: 0 },
  { b: b - w / 2, y: y + h, v: 0 },
]

function lampGeometry(): BufferGeometry {
  const pole = new CylinderGeometry(0.04, 0.065, 3.3, 7)
  pole.translate(0, 1.65, 0)
  const arm = new BoxGeometry(0.9, 0.05, 0.05)
  arm.translate(0.45, 3.28, 0)
  const head = new BoxGeometry(0.42, 0.07, 0.17)
  head.translate(0.86, 3.24, 0)
  const merged = mergeGeometries([pole, arm, head])!
  ;[pole, arm, head].forEach((g) => g.dispose())
  return merged
}

interface BridgeParts {
  meshes: Array<Mesh | InstancedMesh>
  lights: Points
  materials: Material[]
}

const disposeParts = (parts: BridgeParts) => {
  parts.meshes.forEach((mesh) => mesh.geometry.dispose())
  parts.lights.geometry.dispose()
  parts.materials.forEach((material) => material.dispose())
}

/**
 * The lake viaduct: a box-girder deck with sidewalks and steel railings, twin-column piers and lamp posts.
 */
export function Bridge() {
  const { uniforms, pointScale } = useCity()

  const parts = useMemo<BridgeParts>(() => {
    const layout = layoutBridge()
    const { road, length } = layout

    const deckMaterial = createWorldMaterial(uniforms, roadVert, roadFrag, { uLongueur: { value: length } })
    const concrete = createWorldMaterial(uniforms, towerVert, bridgeFrag, { uMat: { value: 0 }, uHautPylone: { value: 7 } })
    const steel = createWorldMaterial(uniforms, towerVert, bridgeFrag, { uMat: { value: 1 }, uHautPylone: { value: 7 } })

    const deck = new Mesh(sweepProfile(road, deckProfile(BRIDGE.roadHalf, BRIDGE.sidewalk, BRIDGE.depth, false), 520), deckMaterial)

    // railings: a top rail and a mid rail on each edge, posts every 1.5 m
    const rails = new Mesh(
      mergeGeometries(
        [-1, 1].flatMap((side) => [
          sweepProfile(road, railProfile(side * (ROAD_EDGE - 0.08), 1.2, 0.09, 0.07), RAIL_SEGMENTS),
          sweepProfile(road, railProfile(side * (ROAD_EDGE - 0.08), 0.68, 0.04, 0.04), RAIL_SEGMENTS),
        ]),
      )!,
      steel,
    )
    const postMatrices: Matrix4[] = []
    const point = new Vector3()
    const tangent = new Vector3()
    const across = new Vector3()
    for (let d = 0.5; d < length; d += POST_SPACING) {
      road.getPoint(d / length, point)
      acrossOf(road.getTangent(d / length, tangent).normalize(), across)
      for (const side of [-1, 1]) {
        const foot = point.clone().addScaledVector(across, side * (ROAD_EDGE - 0.08)).setY(point.y + 0.18)
        postMatrices.push(memberMatrix({ from: foot, to: foot.clone().setY(foot.y + 1.08) }, across, 0.05, 0.05).clone())
      }
    }
    const postGeometry = new BoxGeometry(1, 1, 1)
    postGeometry.translate(0, 0.5, 0)
    const posts = instanced(postGeometry, steel, postMatrices)

    const capGeometry = new BoxGeometry(1, 1, 1)
    capGeometry.translate(0, 0.5, 0)
    const caps = instanced(
      capGeometry,
      concrete,
      layout.caps.map((cap) => memberMatrix(cap, layout.across, 0.55, 1.15).clone()),
    )

    // piers: twin columns with their footings at the water line
    const columnGeometry = new CylinderGeometry(0.3, 0.38, 1, 12)
    columnGeometry.translate(0, 0.5, 0)
    const columns = instanced(
      columnGeometry,
      concrete,
      layout.columns.map((column) => memberMatrix(column, layout.across, 1, 1).clone()),
    )
    const footingGeometry = new CylinderGeometry(0.75, 0.9, 0.8, 16)
    const footings = instanced(
      footingGeometry,
      concrete,
      layout.footings.map((foot) => new Matrix4().makeTranslation(foot.x, 0.0, foot.z)),
    )

    // lamp posts
    const lamps = instanced(
      lampGeometry(),
      steel,
      layout.lamps.map((lamp) => memberMatrix({ from: lamp.foot, to: lamp.foot.clone().setY(lamp.foot.y + 1) }, lamp.reach, 1, 1).clone()),
    )

    // lights: warm lamp heads along the sidewalks
    const lightCount = layout.lamps.length
    const positions = new Float32Array(lightCount * 3)
    const sizes = new Float32Array(lightCount)
    const phases = new Float32Array(lightCount)
    const colors = new Float32Array(lightCount * 3)
    layout.lamps.forEach((lamp, n) => {
      positions.set([lamp.head.x, lamp.head.y - 0.08, lamp.head.z], n * 3)
      sizes[n] = 1.1
      phases[n] = -1
      colors.set([1.0, 0.7, 0.4], n * 3)
    })
    const lightGeometry = new BufferGeometry()
    lightGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    lightGeometry.setAttribute('aTaille', new BufferAttribute(sizes, 1))
    lightGeometry.setAttribute('aPhase', new BufferAttribute(phases, 1))
    lightGeometry.setAttribute('aCouleur', new BufferAttribute(colors, 3))
    const lightMaterial = new ShaderMaterial({
      uniforms: { uTemps: uniforms.uTemps, uNuit: uniforms.uNuit, uEchelle: pointScale },
      vertexShader: lightsVert,
      fragmentShader: lightsFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const lights = new Points(lightGeometry, lightMaterial)
    lights.frustumCulled = false

    const meshes = [deck, rails, posts, caps, columns, footings, lamps]
    meshes.forEach((mesh) => (mesh.frustumCulled = false))
    return { meshes, lights, materials: [deckMaterial, concrete, steel, lightMaterial] }
  }, [uniforms, pointScale])
  useDisposeOnUnmount(parts, disposeParts)

  return (
    <>
      {parts.meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
      <primitive object={parts.lights} />
    </>
  )
}
