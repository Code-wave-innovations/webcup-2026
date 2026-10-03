import { useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { CITY_CENTER, RING, ROAD_LIFT } from '../cityConfig'
import { useCity } from '../CityContext'
import { relief } from '../layout/relief'
import { circleCurve, deckProfile, sweepProfile } from '../layout/sweep'
import { createWorldMaterial } from '../worldMaterial'
import roadVert from '../glsl/road.vert.glsl?raw'
import roadFrag from '../glsl/road.frag.glsl?raw'
import towerVert from '../glsl/tower.vert.glsl?raw'
import bridgeFrag from '../glsl/bridge.frag.glsl?raw'

const PILLARS = 48
const DEPTH = 1.3

const dispose = (parts: { deck: { geometry: { dispose(): void }; material: { dispose(): void } }; pillars: InstancedMesh; caps: InstancedMesh }) => {
  parts.deck.geometry.dispose()
  parts.deck.material.dispose()
  for (const mesh of [parts.pillars, parts.caps]) mesh.geometry.dispose()
  ;(parts.pillars.material as { dispose(): void }).dispose()
}

/** The elevated ring road: a box-girder viaduct with sidewalks and parapets, on columns with hammerhead caps. */
export function Roads() {
  const { uniforms } = useCity()

  const parts = useMemo(() => {
    const curve = circleCurve(CITY_CENTER.x, CITY_CENTER.z, RING.radius, RING.height + ROAD_LIFT)
    const half = RING.deckWidth / 2
    const deck = {
      geometry: sweepProfile(curve, deckProfile(half - 0.6, 0.6, DEPTH, true), 360),
      material: createWorldMaterial(uniforms, roadVert, roadFrag, { uLongueur: { value: curve.getLength() } }),
    }

    const concrete = createWorldMaterial(uniforms, towerVert, bridgeFrag, { uMat: { value: 0 }, uHautPylone: { value: 7 } })
    const column = new CylinderGeometry(0.42, 0.55, 1, 12)
    column.translate(0, 0.5, 0)
    const pillars = new InstancedMesh(column, concrete, PILLARS)
    const cap = new BoxGeometry(1, 1, 1)
    const caps = new InstancedMesh(cap, concrete, PILLARS)
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const position = new Vector3()
    const scale = new Vector3()
    const up = new Vector3(0, 1, 0)
    const underside = RING.height + ROAD_LIFT - DEPTH
    for (let n = 0; n < PILLARS; n++) {
      const a = (n / PILLARS) * Math.PI * 2
      const x = CITY_CENTER.x + Math.cos(a) * RING.radius
      const z = CITY_CENTER.z + Math.sin(a) * RING.radius
      const ground = relief(x, z) - 0.4
      const top = underside - 0.45
      pillars.setMatrixAt(n, matrix.compose(position.set(x, ground, z), rotation.identity(), scale.set(1, top - ground, 1)))
      // hammerhead cap, across the road
      rotation.setFromAxisAngle(up, -a)
      caps.setMatrixAt(n, matrix.compose(position.set(x, top + 0.225, z), rotation, scale.set(half * 1.5, 0.45, 0.9)))
    }
    pillars.frustumCulled = false
    caps.frustumCulled = false
    return { deck, pillars, caps }
  }, [uniforms])
  useDisposeOnUnmount(parts, dispose)

  return (
    <>
      <mesh geometry={parts.deck.geometry} material={parts.deck.material} frustumCulled={false} />
      <primitive object={parts.pillars} />
      <primitive object={parts.caps} />
    </>
  )
}
