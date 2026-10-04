import { DISTRICTS } from '../../experience/city/districts'
import type { AnchorId } from '../../experience/director/frameState'

export interface CitySectionInfo {
  id: string
  /** label on the side rail (the place the camera flies to) */
  rail: string
  /** short label in the top navigation; absent for the arrival */
  nav?: string
  /** full label for title / aria when `nav` is abbreviated */
  navFull?: string
  /** city landmark the panel is linked to by the luminous line */
  anchor?: AnchorId
}

/** One section per camera pose of the flyover (see `CAMERA_POSES` and `DISTRICTS`), in scroll order. */
export const CITY_SECTIONS: readonly CitySectionInfo[] = [
  { id: 'arrivee', rail: 'Arrivée' },
  { id: 'services', rail: 'Dôme central', nav: 'Services', anchor: DISTRICTS[1].anchor },
  { id: 'signaler', rail: 'Dôme 3', nav: 'Signaler', anchor: DISTRICTS[2].anchor },
  { id: 'etat', rail: 'Serre 1', nav: 'État', navFull: 'État de la ville', anchor: DISTRICTS[3].anchor },
  { id: 'conseil', rail: 'Tour du Conseil', nav: 'Annonces', anchor: DISTRICTS[4].anchor },
  { id: 'observatoire', rail: 'Observatoire', nav: 'Nova', navFull: 'Parler à Nova', anchor: DISTRICTS[5].anchor },
  { id: 'registre', rail: "Vue d'ensemble", nav: 'Registre' },
]
