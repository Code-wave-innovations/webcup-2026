import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { useDisposeOnUnmount } from '../../../hooks/useDisposeOnUnmount'
import { director } from '../../director/director'
import { FRAME_PRIORITY } from '../../framePriority'
import { useCity } from '../CityContext'
import { createNpcMesh, createCarGeometry, disposeNpcMesh, markNpc, writeNpc, NPC_KIND } from '../life/npcGeometry'
import { createTraffic, updateTraffic } from '../life/vehiclePaths'

const dispose = disposeNpcMesh

/** Ground traffic on the ring road and the lake bridge. */
export function Vehicles({ light }: { light: boolean }) {
  const { uniforms } = useCity()

  const { vehicles, draw } = useMemo(() => {
    const vehicles = createTraffic(light)
    const draw = createNpcMesh(createCarGeometry(), uniforms, NPC_KIND.vehicle, vehicles.length)
    vehicles.forEach((v, i) => writeNpc(draw, i, v.position.x, v.position.y, v.position.z, v.scale, v.forward.x, v.forward.y, v.forward.z, 0, 0, v.seed))
    markNpc(draw)
    return { vehicles, draw }
  }, [light, uniforms])
  useDisposeOnUnmount(draw, dispose)

  useFrame(() => {
    if (director.stage !== 'city') return
    updateTraffic(vehicles, director.dt)
    vehicles.forEach((v, i) => writeNpc(draw, i, v.position.x, v.position.y, v.position.z, v.scale, v.forward.x, v.forward.y, v.forward.z, 0, 0, v.seed))
    markNpc(draw)
  }, FRAME_PRIORITY.details)

  return <primitive object={draw.mesh} />
}
