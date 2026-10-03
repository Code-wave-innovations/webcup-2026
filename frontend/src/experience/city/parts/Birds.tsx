import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, Mesh, Vector2, Vector3, Vector4, type ShaderMaterial } from 'three'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { createBirdGeometry } from '../birds/birdGeometry'
import { createAviary, type Bird } from '../birds/flight'
import { SPECIES, SPECIES_IDS, type SpeciesId } from '../birds/species'
import { useCity } from '../CityContext'
import { createWorldMaterial, type WorldUniforms } from '../worldMaterial'
import birdVert from '../glsl/bird.vert.glsl?raw'
import birdFrag from '../glsl/bird.frag.glsl?raw'

/** the swallows hunt about this far ahead of the camera, so every district of the flyover has its own */
const LURE_DISTANCE = 34

/** One species: a single instanced draw; per bird: position + size, heading + bank, wingbeat. */
interface SpeciesMesh {
  id: SpeciesId
  mesh: Mesh
  birds: Bird[]
  position: InstancedBufferAttribute
  heading: InstancedBufferAttribute
  wing: InstancedBufferAttribute
}

const disposeMeshes = (meshes: SpeciesMesh[]) =>
  meshes.forEach(({ mesh }) => {
    mesh.geometry.dispose()
    ;(mesh.material as ShaderMaterial).dispose()
  })

function createSpeciesMesh(id: SpeciesId, birds: Bird[], uniforms: WorldUniforms): SpeciesMesh {
  const { planform, glide, beat, colors } = SPECIES[id]
  const geometry = createBirdGeometry(planform)
  geometry.instanceCount = birds.length
  const attribute = (name: string) => {
    const a = new InstancedBufferAttribute(new Float32Array(Math.max(1, birds.length) * 4), 4).setUsage(DynamicDrawUsage)
    geometry.setAttribute(name, a)
    return a
  }
  const material = createWorldMaterial(
    uniforms,
    birdVert,
    birdFrag,
    {
      uForme: { value: new Vector2(planform.root, planform.arm) },
      uVol: { value: new Vector3(glide.shoulder, glide.wrist, glide.sweep) },
      uBattement: { value: new Vector4(beat.shoulder, beat.wrist, beat.lag, beat.sweep) },
      uBattement2: { value: new Vector2(beat.extend, beat.bob) },
      uDessus: { value: new Vector3(...colors.upper) },
      uDessous: { value: new Vector3(...colors.under) },
      uPointes: { value: new Vector3(...colors.tips) },
      uPointesDes: { value: colors.tipsFrom },
      uTete: { value: new Vector3(...colors.head) },
      uQueue: { value: new Vector3(...colors.tail) },
    },
    { side: DoubleSide },
  )
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  const species: SpeciesMesh = { id, mesh, birds, position: attribute('iPos'), heading: attribute('iDir'), wing: attribute('iAile') }
  writeBirds(species)
  return species
}

/** Copies the flight state of every bird of a species into its instanced attributes. */
function writeBirds({ id, birds, position, heading, wing }: SpeciesMesh) {
  const span = SPECIES[id].span
  const p = position.array as Float32Array
  const h = heading.array as Float32Array
  const w = wing.array as Float32Array
  birds.forEach((bird, i) => {
    const k = i * 4
    p[k] = bird.position.x
    p[k + 1] = bird.position.y
    p[k + 2] = bird.position.z
    p[k + 3] = span * bird.scale
    h[k] = bird.forward.x
    h[k + 1] = bird.forward.y
    h[k + 2] = bird.forward.z
    h[k + 3] = bird.bank
    w[k] = bird.phase
    w[k + 1] = bird.flap
    w[k + 2] = bird.seed
  })
  position.needsUpdate = true
  heading.needsUpdate = true
  wing.needsUpdate = true
}

/** The birds of Terra Nova: eagles soaring in thermals, skeins of geese, gulls over the lake, swallows among the towers. */
export function Birds({ light }: { light: boolean }) {
  const { data, uniforms } = useCity()

  const { aviary, meshes } = useMemo(() => {
    const aviary = createAviary(data.towers, light)
    return { aviary, meshes: SPECIES_IDS.map((id) => createSpeciesMesh(id, aviary.birdsOf(id), uniforms)) }
  }, [data, light, uniforms])
  useDisposeOnUnmount(meshes, disposeMeshes)
  const lure = useMemo(() => new Vector3(), [])

  useFrame(() => {
    if (director.stage !== 'city') return
    const camera = director.cameras.city
    aviary.lure(camera ? camera.getWorldDirection(lure).multiplyScalar(LURE_DISTANCE).add(camera.position) : null)
    aviary.update(director.dt, director.time)
    meshes.forEach(writeBirds)
  }, FRAME_PRIORITY.details)

  return (
    <>
      {meshes.map(({ id, mesh }) => (
        <primitive key={id} object={mesh} />
      ))}
    </>
  )
}
