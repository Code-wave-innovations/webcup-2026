import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { DOME_BASE, DOME_FLATTEN, DOMES } from '../cityConfig'
import { useCity } from '../CityContext'
import lightsVert from '../glsl/lights.vert.glsl?raw'
import lightsFrag from '../glsl/lights.frag.glsl?raw'

/** Blinking red beacons on every tower top, steady ice-blue lights on the dome tops. */
export function Beacons() {
  const { data, uniforms, pointScale } = useCity()

  const { geometry, material } = useMemo(() => {
    const count = data.towers.length + DOMES.length
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    data.towers.forEach((t, n) => {
      positions.set([t.x, 0.5 + t.height + 0.4, t.z], n * 3)
      sizes[n] = 0.9 + t.height * 0.022
      phases[n] = data.beaconPhases[n]
      colors.set([1, 0.16, 0.08], n * 3)
    })
    DOMES.forEach((d, k) => {
      const n = data.towers.length + k
      positions.set([d.x, DOME_BASE + d.r * DOME_FLATTEN + 0.5, d.z], n * 3)
      sizes[n] = 1.7
      phases[n] = -1
      colors.set([0.6, 0.95, 1], n * 3)
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aTaille', new BufferAttribute(sizes, 1))
    g.setAttribute('aPhase', new BufferAttribute(phases, 1))
    g.setAttribute('aCouleur', new BufferAttribute(colors, 3))
    const m = new ShaderMaterial({
      uniforms: { uTemps: uniforms.uTemps, uNuit: uniforms.uNuit, uEchelle: pointScale },
      vertexShader: lightsVert,
      fragmentShader: lightsFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { geometry: g, material: m }
  }, [data, uniforms, pointScale])

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
