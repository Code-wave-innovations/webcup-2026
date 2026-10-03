import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, ShaderMaterial, type Group, type Mesh } from 'three'
import { director } from '../../director/director'
import { useDirectorStore } from '../../director/directorStore'
import { FRAME_PRIORITY } from '../../framePriority'
import { COUNCIL_TOWER, DOME_BASE, DOME_FLATTEN, DOMES } from '../cityConfig'
import beamVert from '../glsl/beam.vert.glsl?raw'
import beamFrag from '../glsl/beam.frag.glsl?raw'

/** Beam colour per report status: received (red), taken / in progress (amber), resolved (green). */
const STATUS_TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0.28, 0.18],
  [1, 0.62, 0.22],
  [1, 0.62, 0.22],
  [0.3, 1, 0.6],
]

function beamMaterial(uniforms: { uCouleur: { value: Color }; uForce: { value: number } }) {
  return new ShaderMaterial({
    uniforms,
    vertexShader: beamVert,
    fragmentShader: beamFrag,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
}

const DOME_THREE = DOMES.find((d) => d.id === 'trois')!

/** The light beam rising over dome 3 while the visitor's report is open; it turns green, then dims, once resolved. */
export function SignalBeam() {
  const meshRef = useRef<Mesh>(null)
  const { geometry, material, uniforms, state } = useMemo(() => {
    const g = new CylinderGeometry(0.9, 0.5, 60, 24, 1, true)
    g.translate(0, 30, 0)
    const u = { uCouleur: { value: new Color(1, 0.3, 0.2) }, uForce: { value: 0 } }
    return { geometry: g, material: beamMaterial(u), uniforms: u, state: { strength: 0 } }
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || director.stage !== 'city') return
    const dt = director.dt
    const status = useDirectorStore.getState().signalStatus
    const target = status >= 0 && status < 3 ? 1 : status === 3 ? 0.35 : 0
    state.strength += (target - state.strength) * Math.min(1, dt * 2.5)
    if (status >= 0) {
      const [r, g, b] = STATUS_TINTS[status]
      const c = uniforms.uCouleur.value
      c.setRGB(c.r + (r - c.r) * 0.08, c.g + (g - c.g) * 0.08, c.b + (b - c.b) * 0.08)
    }
    uniforms.uForce.value = state.strength * (2.2 + Math.sin(director.time * 4) * 0.7)
    mesh.visible = state.strength > 0.01
  }, FRAME_PRIORITY.details)

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      visible={false}
      position={[DOME_THREE.x, DOME_BASE + DOME_THREE.r * DOME_FLATTEN, DOME_THREE.z]}
    />
  )
}

/** Three red spotlights sweeping from the top of the council tower during an alert. */
export function AlertSpotlights({ alertLevel }: { alertLevel: { value: number } }) {
  const groupRef = useRef<Group>(null)
  const { geometry, material, uniforms } = useMemo(() => {
    const g = new CylinderGeometry(9, 0.3, 110, 28, 1, true)
    g.translate(0, 55, 0)
    const u = { uCouleur: { value: new Color(1, 0.12, 0.06) }, uForce: { value: 0 } }
    return { geometry: g, material: beamMaterial(u), uniforms: u }
  }, [])

  useFrame(() => {
    const group = groupRef.current
    if (!group || director.stage !== 'city') return
    uniforms.uForce.value = alertLevel.value * 1.6
    group.visible = alertLevel.value > 0.01
    group.rotation.y = director.time * 0.7
  }, FRAME_PRIORITY.details)

  return (
    <group ref={groupRef} position={[COUNCIL_TOWER.x, 0.5 + COUNCIL_TOWER.h, COUNCIL_TOWER.z]} visible={false}>
      {[0, 2.1, 4.2].map((azimuth) => (
        <mesh key={azimuth} geometry={geometry} material={material} rotation={[0, azimuth, 1.15, 'YXZ']} />
      ))}
    </group>
  )
}
