import type { AnchorId } from '../../experience/director/frameState'

export interface CitySectionInfo {
  id: string
  /** label on the side rail (the place the camera flies to) */
  rail: string
  /** label in the top navigation; absent for the arrival */
  nav?: string
  /** city landmark the panel is linked to by the luminous line */
  anchor?: AnchorId
}

/** One section per camera pose of the flyover (see `CAMERA_POSES`), in scroll order. */
export const CITY_SECTIONS: readonly CitySectionInfo[] = [
  { id: 'arrivee', rail: 'Arrivée' },
  { id: 'services', rail: 'Dôme central', nav: 'Services', anchor: 'central' },
  { id: 'signaler', rail: 'Dôme 3', nav: 'Signaler', anchor: 'trois' },
  { id: 'etat', rail: 'Serre 1', nav: 'État de la ville', anchor: 'serre' },
  { id: 'conseil', rail: 'Tour du Conseil', nav: 'Haut Conseil', anchor: 'conseil' },
  { id: 'registre', rail: "Vue d'ensemble", nav: 'Registre' },
]
