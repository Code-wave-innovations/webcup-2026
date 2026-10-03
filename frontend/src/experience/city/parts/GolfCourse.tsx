import { useMemo } from 'react'
import {
  BoxGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { createRandom } from '../../../lib/random'
import { CITY_SEED, POIS } from '../cityConfig'
import { relief } from '../layout/relief'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import towerVert from '../glsl/tower.vert.glsl?raw'
import poiFrag from '../glsl/poi.frag.glsl?raw'

const GOLF = POIS.find((p) => p.id === 'golf')!
const HOLES = 9
const BUNKERS = 6
const FLAG_HEIGHT = 3.5
const SEED = CITY_SEED + 501

/** Golf course: green fairway patches, sand bunkers, flag poles, and a small clubhouse. */
export function GolfCourse() {
  const { uniforms } = useCity()

  const meshes = useMemo(() => {
    const random = createRandom(SEED)
    const mat4 = new Matrix4()
    const quat = new Quaternion()
    const pos = new Vector3()
    const scl = new Vector3()
    const identity = new Quaternion()

    // fairway greens: flattened cylinders
    const greenGeo = new CylinderGeometry(1, 1, 0.08, 16)
    const greenMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.0 },
      uEmis: { value: 0.0 },
    })
    const greens = new InstancedMesh(greenGeo, greenMat, HOLES)
    const seeds = new Float32Array(HOLES)
    for (let i = 0; i < HOLES; i++) {
      const angle = (i / HOLES) * Math.PI * 2 + random() * 0.4
      const r = 4 + random() * (GOLF.radius - 8)
      const x = GOLF.x + Math.cos(angle) * r
      const z = GOLF.z + Math.sin(angle) * r
      const y = Math.max(relief(x, z), 0)
      const radius = 2.5 + random() * 3
      pos.set(x, y + 0.04, z)
      scl.set(radius, 1, radius * (0.6 + random() * 0.4))
      greens.setMatrixAt(i, mat4.compose(pos, identity, scl))
      seeds[i] = random()
    }
    greens.frustumCulled = false

    // sand bunkers: tan low cylinders
    const bunkerGeo = new CylinderGeometry(1, 1, 0.06, 12)
    const bunkerMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.12 },
      uEmis: { value: 0.0 },
    })
    const bunkers = new InstancedMesh(bunkerGeo, bunkerMat, BUNKERS)
    for (let i = 0; i < BUNKERS; i++) {
      const angle = random() * Math.PI * 2
      const r = 3 + random() * (GOLF.radius - 6)
      const x = GOLF.x + Math.cos(angle) * r
      const z = GOLF.z + Math.sin(angle) * r
      const y = Math.max(relief(x, z), 0)
      pos.set(x, y + 0.03, z)
      scl.set(1.2 + random() * 1.5, 1, 1 + random() * 1.2)
      bunkers.setMatrixAt(i, mat4.compose(pos, quat.setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI), scl))
    }
    bunkers.frustumCulled = false

    // flag poles: thin cylinders at each green
    const poleGeo = new CylinderGeometry(0.04, 0.04, FLAG_HEIGHT, 4)
    poleGeo.translate(0, FLAG_HEIGHT / 2, 0)
    const poleMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.85 },
      uEmis: { value: 0.3 },
    })
    const poles = new InstancedMesh(poleGeo, poleMat, HOLES)
    for (let i = 0; i < HOLES; i++) {
      const m = new Matrix4()
      greens.getMatrixAt(i, m)
      pos.setFromMatrixPosition(m)
      scl.set(1, 1, 1)
      poles.setMatrixAt(i, mat4.compose(pos, identity, scl))
    }
    poles.frustumCulled = false

    // clubhouse: a single box
    const clubX = GOLF.x + 2
    const clubZ = GOLF.z + GOLF.radius - 3
    const clubY = Math.max(relief(clubX, clubZ), 0)
    const clubGeo = new BoxGeometry(6, 3.5, 4)
    clubGeo.translate(0, 1.75, 0)
    const clubMat = createWorldMaterial(uniforms, towerVert, poiFrag, {
      uTint: { value: 0.45 },
      uEmis: { value: 0.15 },
    })

    return { greens, bunkers, poles, clubGeo, clubMat, clubPos: [clubX, clubY, clubZ] as const }
  }, [uniforms])

  return (
    <>
      <primitive object={meshes.greens} />
      <primitive object={meshes.bunkers} />
      <primitive object={meshes.poles} />
      <mesh
        geometry={meshes.clubGeo}
        material={meshes.clubMat}
        position={[meshes.clubPos[0], meshes.clubPos[1], meshes.clubPos[2]]}
        frustumCulled={false}
      />
    </>
  )
}
