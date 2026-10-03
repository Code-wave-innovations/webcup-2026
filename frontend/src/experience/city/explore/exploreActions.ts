import { director } from '../../director/director'
import { novaScenes } from '../../nova/behavior/scenes'
import { poiById, type PoiId } from '../cityConfig'

/** What the interface does to explore: the director moves the film, Nova says a word about it. */
export const exploreActions = {
  /** take off from the flyover towards the golf course */
  enter(): void {
    if (director.phase !== 'city') return
    director.enterExplore()
    novaScenes.enterStreets(poiById('golf').name)
  },
  /** back to the flyover */
  leave(): void {
    if (director.phase !== 'explore') return
    novaScenes.leaveStreets()
    director.exitExplore()
  },
  /** from one site to another */
  flyTo(id: PoiId): void {
    if (!director.site || director.flying) return
    director.flyTo(id)
    novaScenes.flyToPoi(poiById(id).name)
  },
}
