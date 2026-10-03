import { useMemo } from 'react'
import { BoxGeometry, CatmullRomCurve3, InstancedMesh, Matrix4, Quaternion, TorusGeometry, TubeGeometry, Vector3 } from 'three'
import { BRIDGE_PATH, CITY_CENTER, RING } from '../cityConfig'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import roadVert from '../glsl/road.vert.glsl?raw'
import roadFrag from '../glsl/road.frag.glsl?raw'
import towerVert from '../glsl/tower.vert.glsl?raw'
import plainFrag from '../glsl/plain.frag.glsl?raw'

const RING_PILLARS = 40
const BRIDGE_PILLARS = 25

/** Elevated ring road and the bridge over the lake, with traffic lights running along them, on pillars. */
export function Roads() {
  const { uniforms } = useCity()

  const parts = useMemo(() => {
    const ringGeometry = new TorusGeometry(RING.radius, RING.tube, 6, 240)
    ringGeometry.rotateX(Math.PI / 2)
    const ringMaterial = createWorldMaterial(uniforms, roadVert, roadFrag, { uLongueur: { value: 2 * Math.PI * RING.radius } })

    const path = new CatmullRomCurve3(BRIDGE_PATH.map(([x, y, z]) => new Vector3(x, y, z)))
    const bridgeGeometry = new TubeGeometry(path, 220, RING.tube, 6, false)
    const bridgeMaterial = createWorldMaterial(uniforms, roadVert, roadFrag, { uLongueur: { value: path.getLength() } })

    const feet: Array<readonly [x: number, z: number, deck: number]> = []
    for (let i = 0; i < RING_PILLARS; i++) {
      const a = (i / RING_PILLARS) * Math.PI * 2
      feet.push([CITY_CENTER.x + Math.cos(a) * RING.radius, CITY_CENTER.z + Math.sin(a) * RING.radius, RING.height])
    }
    for (let i = 1; i <= BRIDGE_PILLARS; i++) {
      const p = path.getPoint(i / 60)
      feet.push([p.x, p.z, p.y])
    }
    const pillars = new InstancedMesh(new BoxGeometry(0.34, 1, 0.34), createWorldMaterial(uniforms, towerVert, plainFrag), feet.length)
    const matrix = new Matrix4()
    const identity = new Quaternion()
    feet.forEach(([x, z, deck], n) => {
      matrix.compose(new Vector3(x, (deck - 3) / 2 - 0.2, z), identity, new Vector3(1, deck + 3, 1))
      pillars.setMatrixAt(n, matrix)
    })
    pillars.frustumCulled = false
    return { ringGeometry, ringMaterial, bridgeGeometry, bridgeMaterial, pillars }
  }, [uniforms])

  return (
    <>
      <mesh geometry={parts.ringGeometry} material={parts.ringMaterial} position={[CITY_CENTER.x, RING.height, CITY_CENTER.z]} />
      <mesh geometry={parts.bridgeGeometry} material={parts.bridgeMaterial} />
      <primitive object={parts.pillars} />
    </>
  )
}
