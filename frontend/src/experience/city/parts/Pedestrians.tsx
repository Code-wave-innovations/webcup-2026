import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { useCity } from '../CityContext'
import {
  createAnimalGeometry,
  createNpcMesh,
  createPersonGeometry,
  disposeNpcMesh,
  markNpc,
  writeNpc,
  NPC_KIND,
  type NpcMesh,
} from '../life/npcGeometry'
import { createAnimals, createWalkers, updateAnimals, updateWalkers } from '../life/pedestrianPaths'

const disposePair = (pair: { people: NpcMesh; animals: NpcMesh }) => {
  disposeNpcMesh(pair.people)
  disposeNpcMesh(pair.animals)
}

/** Residents on the avenues and small animals around the trees. */
export function Pedestrians({ light }: { light: boolean }) {
  const { data, uniforms } = useCity()

  const { walkers, animals, draws } = useMemo(() => {
    const walkers = createWalkers(light)
    const animals = createAnimals(data.trees, light)
    const people = createNpcMesh(createPersonGeometry(), uniforms, NPC_KIND.pedestrian, walkers.length)
    const beasts = createNpcMesh(createAnimalGeometry(), uniforms, NPC_KIND.animal, animals.length)
    walkers.forEach((w, i) => writeNpc(people, i, w.position.x, w.position.y, w.position.z, w.scale, w.forward.x, w.forward.y, w.forward.z, w.phase, 0.035, w.seed))
    animals.forEach((a, i) => writeNpc(beasts, i, a.position.x, a.position.y, a.position.z, a.scale, a.forward.x, a.forward.y, a.forward.z, a.phase, 0.02, a.seed))
    markNpc(people)
    markNpc(beasts)
    return { walkers, animals, draws: { people, animals: beasts } }
  }, [data, light, uniforms])
  useDisposeOnUnmount(draws, disposePair)

  useFrame(() => {
    if (director.stage !== 'city') return
    updateWalkers(walkers, director.dt)
    updateAnimals(animals, director.dt)
    walkers.forEach((w, i) => writeNpc(draws.people, i, w.position.x, w.position.y, w.position.z, w.scale, w.forward.x, w.forward.y, w.forward.z, w.phase, 0.035, w.seed))
    animals.forEach((a, i) => writeNpc(draws.animals, i, a.position.x, a.position.y, a.position.z, a.scale, a.forward.x, a.forward.y, a.forward.z, a.phase, 0.02, a.seed))
    markNpc(draws.people)
    markNpc(draws.animals)
  }, FRAME_PRIORITY.details)

  return (
    <>
      <primitive object={draws.people.mesh} />
      <primitive object={draws.animals.mesh} />
    </>
  )
}
