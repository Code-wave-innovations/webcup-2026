import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, PlaneGeometry, ShaderMaterial, type Mesh } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { NOVA_LAYER } from '../../nova/stage/placement'
import valueNoise from '../../glsl/valueNoise.glsl?raw'
import cloudsVert from '../glsl/clouds.vert.glsl?raw'
import cloudsFrag from '../glsl/clouds.frag.glsl?raw'

const disposeClouds = (clouds: { geometry: PlaneGeometry; material: ShaderMaterial }) => {
  clouds.geometry.dispose()
  clouds.material.dispose()
}

/**
 * The cloud deck the camera falls through just after the white-out (the entry timeline's `clouds` cue):
 * one full-screen draw, only while it is crossed. Drawn by the stage camera only, not in the lake's mirror.
 */
export function DescentClouds() {
  const meshRef = useRef<Mesh>(null)
  const size = useThree((s) => s.size)
  const clouds = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1)
    const material = new ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uOpacity: { value: 0 },
        uAspect: { value: 1 },
        uLit: { value: new Color(1.25, 1.0, 0.82) },
        uShade: { value: new Color(0.52, 0.42, 0.46) },
      },
      vertexShader: cloudsVert,
      fragmentShader: `${valueNoise}\n${cloudsFrag}`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    return { geometry, material }
  }, [])
  useDisposeOnUnmount(clouds, disposeClouds)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const { clouds: progress } = director.cues
    mesh.visible = director.stage === 'city' && progress > 0 && progress < 1
    if (!mesh.visible) return
    const u = clouds.material.uniforms
    u.uProgress.value = progress
    u.uOpacity.value = 0.92
    u.uAspect.value = size.width / size.height
  }, FRAME_PRIORITY.details)

  return (
    <mesh
      ref={meshRef}
      geometry={clouds.geometry}
      material={clouds.material}
      frustumCulled={false}
      renderOrder={20}
      visible={false}
      onUpdate={(mesh) => mesh.layers.set(NOVA_LAYER)}
    />
  )
}
