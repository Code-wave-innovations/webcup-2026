import { Pedestrians } from './Pedestrians'
import { Vehicles } from './Vehicles'

/** Ambient life of Terra Nova: traffic on the roads, walkers on the avenues, animals in the gardens. */
export function CityLife({ light }: { light: boolean }) {
  return (
    <>
      <Vehicles light={light} />
      <Pedestrians light={light} />
    </>
  )
}
