import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, type IUniform } from 'three'
import { createRandom } from '../../lib/random'
import starsVert from './glsl/stars.vert.glsl?raw'
import starsFrag from './glsl/stars.frag.glsl?raw'

export interface StarUniforms {
  [name: string]: IUniform
  uTemps: IUniform<number>
  uDpr: IUniform<number>
}

const RADIUS = 400
const SEED = 1977

/** Twinkling star sphere around the ship (warm and cool stars, a few bright ones). */
export function Starfield({ count, uniforms }: { count: number; uniforms: StarUniforms }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const random = createRandom(SEED)
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1
      const angle = random() * Math.PI * 2
      const ring = Math.sqrt(1 - u * u)
      positions.set([RADIUS * ring * Math.cos(angle), RADIUS * u, RADIUS * ring * Math.sin(angle)], i * 3)
      sizes[i] = 1 + Math.pow(random(), 5) * 4.2
      phases[i] = random()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('taille', new BufferAttribute(sizes, 1))
    g.setAttribute('phase', new BufferAttribute(phases, 1))
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader: starsVert,
        fragmentShader: starsFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [uniforms],
  )

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
