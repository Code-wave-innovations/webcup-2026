import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, PlaneGeometry, ShaderMaterial, Vector3, type IUniform } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { damp } from '../../../lib/math'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { useCity } from '../CityContext'
import { DISTRICTS } from '../districts'
import { ANCHORS, MARKERS } from '../landmarks'
import markerVert from '../glsl/marker.vert.glsl?raw'
import markerFrag from '../glsl/marker.frag.glsl?raw'

const disposeMarkers = (markers: { geometry: PlaneGeometry; materials: ShaderMaterial[] }) => {
  markers.geometry.dispose()
  markers.materials.forEach((m) => m.dispose())
}

/**
 * Holographic markers over the districts: a hexagon and a thread of light down to the landmark, lit up
 * (with a ripple) while the visitor reads that district's section.
 */
export function DistrictMarkers() {
  const { uniforms } = useCity()

  const markers = useMemo(() => {
    // hexagon on top (y -0.5 → 0.5), thread below (down to -1.5)
    const geometry = new PlaneGeometry(1, 2).translate(0, -0.5, 0)
    const materials = MARKERS.map(
      ({ anchor, lift }) =>
        new ShaderMaterial({
          uniforms: {
            uCentre: { value: ANCHORS[anchor].clone().add(new Vector3(0, lift, 0)) },
            uActif: { value: 0 } as IUniform<number>,
            uTemps: uniforms.uTemps,
            uNuit: uniforms.uNuit,
            uAlerte: uniforms.uAlerte,
          },
          vertexShader: markerVert,
          fragmentShader: markerFrag,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
    )
    return { geometry, materials }
  }, [uniforms])
  useDisposeOnUnmount(markers, disposeMarkers)

  useFrame(() => {
    if (director.stage !== 'city') return
    const reading = director.phase === 'city' ? DISTRICTS[director.section]?.anchor : undefined
    MARKERS.forEach(({ anchor }, i) => {
      const active = markers.materials[i].uniforms.uActif
      active.value += ((anchor === reading ? 1 : 0) - active.value) * damp(4, director.dt)
    })
  }, FRAME_PRIORITY.details)

  return (
    <>
      {markers.materials.map((material, i) => (
        <mesh key={MARKERS[i].anchor} geometry={markers.geometry} material={material} frustumCulled={false} renderOrder={5} />
      ))}
    </>
  )
}
