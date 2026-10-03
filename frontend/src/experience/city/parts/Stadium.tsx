import { useMemo } from 'react'
import {
  BoxGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { POIS } from '../cityConfig'
import { relief } from '../layout/relief'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import towerVert from '../glsl/tower.vert.glsl?raw'
import poiFrag from '../glsl/poi.frag.glsl?raw'

const STADE = POIS.find((p) => p.id === 'stade')!
const STAND_SEGMENTS = 36
const FIELD_W = 30
const FIELD_D = 18
const STAND_H = 6
const STAND_DEPTH = 4
const FLOODLIGHT_H = 18

/** Football stadium: oval stands, a green field, four floodlight poles. */
export function Stadium() {
  const { uniforms } = useCity()

  const parts = useMemo(() => {
    const mat4 = new Matrix4()
    const pos = new Vector3()
    const scl = new Vector3()
    const quat = new Quaternion()
    const yAxis = new Vector3(0, 1, 0)
    const groundY = Math.max(relief(STADE.x, STADE.z), 0)

    // stands: instanced boxes arranged in an oval
    const standGeo = new BoxGeometry(1, 1, 1)
    standGeo.translate(0, 0.5, 0)
    const standMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.3 },
      uEmis: { value: 0.0 },
    })
    const stands = new InstancedMesh(standGeo, standMat, STAND_SEGMENTS)
    const seeds = new Float32Array(STAND_SEGMENTS)
    for (let i = 0; i < STAND_SEGMENTS; i++) {
      const a = (i / STAND_SEGMENTS) * Math.PI * 2
      const rx = FIELD_W / 2 + STAND_DEPTH / 2 + 1
      const rz = FIELD_D / 2 + STAND_DEPTH / 2 + 1
      const cx = STADE.x + Math.cos(a) * rx
      const cz = STADE.z + Math.sin(a) * rz
      const segW = (2 * Math.PI * Math.max(rx, rz)) / STAND_SEGMENTS + 0.2
      pos.set(cx, groundY, cz)
      scl.set(segW, STAND_H * (0.8 + 0.2 * Math.abs(Math.sin(a * 2))), STAND_DEPTH)
      stands.setMatrixAt(i, mat4.compose(pos, quat.setFromAxisAngle(yAxis, -a), scl))
      seeds[i] = i / STAND_SEGMENTS
    }
    stands.frustumCulled = false

    // field: a flat green plane
    const fieldGeo = new PlaneGeometry(FIELD_W, FIELD_D)
    fieldGeo.rotateX(-Math.PI / 2)
    const fieldMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.0 },
      uEmis: { value: 0.0 },
    })

    // floodlights: 4 tall poles at the corners
    const poleGeo = new CylinderGeometry(0.2, 0.3, FLOODLIGHT_H, 6)
    poleGeo.translate(0, FLOODLIGHT_H / 2, 0)
    const poleMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.85 },
      uEmis: { value: 0.08 },
    })
    const poles = new InstancedMesh(poleGeo, poleMat, 4)
    const corners = [
      [FIELD_W / 2 + 2, FIELD_D / 2 + 2],
      [-FIELD_W / 2 - 2, FIELD_D / 2 + 2],
      [-FIELD_W / 2 - 2, -FIELD_D / 2 - 2],
      [FIELD_W / 2 + 2, -FIELD_D / 2 - 2],
    ] as const
    const identity = new Quaternion()
    const one = new Vector3(1, 1, 1)
    corners.forEach(([dx, dz], n) => {
      pos.set(STADE.x + dx, groundY, STADE.z + dz)
      poles.setMatrixAt(n, mat4.compose(pos, identity, one))
    })
    poles.frustumCulled = false

    return { stands, fieldGeo, fieldMat, poles, groundY }
  }, [uniforms])

  return (
    <>
      <primitive object={parts.stands} />
      <mesh
        geometry={parts.fieldGeo}
        material={parts.fieldMat}
        position={[STADE.x, parts.groundY + 0.05, STADE.z]}
        frustumCulled={false}
      />
      <primitive object={parts.poles} />
    </>
  )
}
