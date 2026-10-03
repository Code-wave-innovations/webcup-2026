import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { CITY_CENTER } from '../cityConfig'
import { useCity } from '../CityContext'
import lightsVert from '../glsl/lights.vert.glsl?raw'
import lightsFrag from '../glsl/lights.frag.glsl?raw'

const TRAIL = 12
const TRAIL_SPACING = 0.16

/** Shuttles circling the city on tilted ellipses: a bright head and a fading trail of points. */
export function Shuttles() {
  const { data, uniforms, pointScale } = useCity()
  const routes = data.shuttles

  const { geometry, material, positions } = useMemo(() => {
    const count = routes.length * TRAIL
    const positionArray = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count).fill(-1)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < routes.length; i++) {
      for (let j = 0; j < TRAIL; j++) {
        const q = i * TRAIL + j
        const fade = 1 - j / TRAIL
        sizes[q] = (j ? 0.7 : 1.7) * fade
        colors.set([(j ? 0.55 : 1) * fade, (j ? 0.85 : 1) * fade, fade], q * 3)
      }
    }
    const g = new BufferGeometry()
    const position = new BufferAttribute(positionArray, 3)
    g.setAttribute('position', position)
    g.setAttribute('aTaille', new BufferAttribute(sizes, 1))
    g.setAttribute('aPhase', new BufferAttribute(phases, 1))
    g.setAttribute('aCouleur', new BufferAttribute(colors, 3))
    const m = new ShaderMaterial({
      uniforms: { uTemps: uniforms.uTemps, uNuit: { value: 1 }, uEchelle: pointScale },
      vertexShader: lightsVert,
      fragmentShader: lightsFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { geometry: g, material: m, positions: position }
  }, [routes, uniforms, pointScale])

  useFrame(() => {
    if (director.stage !== 'city') return
    const t = director.time
    const array = positions.array as Float32Array
    routes.forEach((r, i) => {
      for (let j = 0; j < TRAIL; j++) {
        const s = r.phase + (t - j * TRAIL_SPACING) * r.speed
        const q = (i * TRAIL + j) * 3
        array[q] = CITY_CENTER.x + Math.cos(s) * r.radiusX
        array[q + 1] = r.altitude + Math.sin(s * 2 + r.phase) * 5 + Math.sin(s) * r.radiusX * r.tilt * 0.3
        array[q + 2] = CITY_CENTER.z + Math.sin(s) * r.radiusZ
      }
    })
    positions.needsUpdate = true
  }, FRAME_PRIORITY.details)

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
