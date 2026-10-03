import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector3, type IUniform } from 'three'
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
/** share of the stars crowded along the galactic plane, and that band's thickness */
const BAND_SHARE = 0.38
const BAND_SPREAD = 0.11
/** pole of the galactic plane: the band crosses the sky diagonally */
const GALACTIC_POLE = new Vector3(0.35, 0.82, 0.45).normalize()

/**
 * Stars as seen from orbit: steady (no atmosphere to make them twinkle), mostly faint, a few bright ones,
 * coloured by temperature, and a denser band where the galaxy lies.
 */
export function Starfield({ count, uniforms }: { count: number; uniforms: StarUniforms }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const temperatures = new Float32Array(count)
    const random = createRandom(SEED)
    const point = new Vector3()
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1
      const angle = random() * Math.PI * 2
      const ring = Math.sqrt(1 - u * u)
      point.set(ring * Math.cos(angle), u, ring * Math.sin(angle))
      // pull a share of the stars towards the galactic plane
      if (random() < BAND_SHARE) {
        const offset = point.dot(GALACTIC_POLE)
        const gauss = (random() + random() + random() - 1.5) * BAND_SPREAD
        point.addScaledVector(GALACTIC_POLE, gauss - offset).normalize()
      }
      positions.set([point.x * RADIUS, point.y * RADIUS, point.z * RADIUS], i * 3)
      sizes[i] = 0.9 + Math.pow(random(), 7) * 4.6
      temperatures[i] = random()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('taille', new BufferAttribute(sizes, 1))
    g.setAttribute('phase', new BufferAttribute(temperatures, 1))
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
