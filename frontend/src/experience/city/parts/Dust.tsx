import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { createRandom } from '../../../lib/random'
import { NOVA_LAYER } from '../../nova/stage/placement'
import { useCity } from '../CityContext'
import dustVert from '../glsl/dust.vert.glsl?raw'
import dustFrag from '../glsl/dust.frag.glsl?raw'

const disposePoints = (points: Points) => {
  points.geometry.dispose()
  ;(points.material as ShaderMaterial).dispose()
}

/** Golden dust floating in the light near the camera (one draw; not in the lake's reflection). */
export function Dust({ count }: { count: number }) {
  const { uniforms, pointScale } = useCity()

  const points = useMemo(() => {
    const random = createRandom(7)
    const positions = Float32Array.from({ length: count * 3 }, () => random())
    const seeds = Float32Array.from({ length: count }, () => random())
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aGraine', new BufferAttribute(seeds, 1))
    const material = new ShaderMaterial({
      uniforms: { uTemps: uniforms.uTemps, uSoleil: uniforms.uSoleil, uNuit: uniforms.uNuit, uEchelle: pointScale },
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const created = new Points(geometry, material)
    created.frustumCulled = false
    created.layers.set(NOVA_LAYER)
    return created
  }, [count, uniforms, pointScale])
  useDisposeOnUnmount(points, disposePoints)

  return <primitive object={points} />
}
