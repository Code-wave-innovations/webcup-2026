import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, LatheGeometry, ShaderMaterial, SphereGeometry, TorusGeometry, Vector2, type Mesh } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { OBSERVATORY } from '../cityConfig'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import towerVert from '../glsl/tower.vert.glsl?raw'
import domeFrag from '../glsl/dome.frag.glsl?raw'
import haloVert from '../glsl/halo.vert.glsl?raw'
import haloFrag from '../glsl/halo.frag.glsl?raw'

/** Silhouette (unit height, radius in tower widths): a slender shaft, a wide balcony, a glass cap on top. */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0], [0.5, 0.04], [0.3, 0.09], [0.21, 0.72], [0.27, 0.8], [0.62, 0.815], [0.62, 0.835], [0.36, 0.85], [0.3, 0.92], [0.31, 0.93],
]
const WIDTH = OBSERVATORY.radius * 2

const disposeParts = (parts: { geometries: Array<{ dispose(): void }>; materials: Array<{ dispose(): void }> }) => {
  parts.geometries.forEach((g) => g.dispose())
  parts.materials.forEach((m) => m.dispose())
}

/** The Observatory tower, where Nova chats with the residents at night: shaft, balcony, glass cap and a holographic ring. */
export function Observatory({ material }: { material: ShaderMaterial }) {
  const { uniforms } = useCity()
  const ringRef = useRef<Mesh>(null)

  const parts = useMemo(() => {
    const shaft = new LatheGeometry(PROFILE.map(([r, h]) => new Vector2(r, h)), 28)
    const cap = new SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    const capMaterial = createWorldMaterial(uniforms, towerVert, domeFrag, { uChaleur: { value: 0.35 } })
    const ring = new TorusGeometry(1, 0.035, 6, 96)
    const ringMaterial = new ShaderMaterial({
      uniforms: { uTemps: uniforms.uTemps, uNuit: uniforms.uNuit, uAlerte: uniforms.uAlerte },
      vertexShader: haloVert,
      fragmentShader: haloFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    return { shaft, cap, capMaterial, ring, ringMaterial, geometries: [shaft, cap, ring], materials: [capMaterial, ringMaterial] }
  }, [uniforms])
  useDisposeOnUnmount(parts, disposeParts)

  useFrame(() => {
    const ring = ringRef.current
    if (!ring || director.stage !== 'city') return
    ring.rotation.z = Math.sin(director.time * 0.4) * 0.12
    ring.rotation.y += director.dt * 0.25
  }, FRAME_PRIORITY.details)

  const capY = OBSERVATORY.h * OBSERVATORY.capAt
  const capRadius = WIDTH * OBSERVATORY.capRadius
  return (
    <group position={[OBSERVATORY.x, 0.5, OBSERVATORY.z]}>
      <mesh geometry={parts.shaft} material={material} scale={[WIDTH, OBSERVATORY.h, WIDTH]} />
      <mesh geometry={parts.cap} material={parts.capMaterial} position-y={capY} scale={[capRadius, capRadius * 0.9, capRadius]} />
      <group position-y={capY + capRadius * 0.35}>
        <mesh ref={ringRef} geometry={parts.ring} material={parts.ringMaterial} scale={capRadius * 1.9} rotation-x={Math.PI / 2} />
      </group>
    </group>
  )
}
