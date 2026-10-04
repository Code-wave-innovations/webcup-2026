import { DISTRICTS } from '../../experience/city/districts'
import type { AnchorId } from '../../experience/director/frameState'
import { defineMessages, useMessages } from '../../i18n'

export type CitySectionId = 'arrivee' | 'services' | 'signaler' | 'etat' | 'conseil' | 'observatoire' | 'registre'

export interface CitySectionInfo {
  id: CitySectionId
  /** city landmark the panel is linked to by the luminous line */
  anchor?: AnchorId
}

/** One section per camera pose of the flyover (see `CAMERA_POSES` and `DISTRICTS`), in scroll order. */
export const CITY_SECTIONS: readonly CitySectionInfo[] = [
  { id: 'arrivee' },
  { id: 'services', anchor: DISTRICTS[1].anchor },
  { id: 'signaler', anchor: DISTRICTS[2].anchor },
  { id: 'etat', anchor: DISTRICTS[3].anchor },
  { id: 'conseil', anchor: DISTRICTS[4].anchor },
  { id: 'observatoire', anchor: DISTRICTS[5].anchor },
  { id: 'registre' },
]

/**
 * D14: the labels of each section. `rail` names the place the camera flies to (side rail), `nav` is the short
 * label of the top navigation (empty: not in it, the arrival) and `full` its long form for title / aria.
 */
const labels = defineMessages(
  {
    arrivee: { rail: 'Arrivée', nav: '', full: '' },
    services: { rail: 'Dôme central', nav: 'Services', full: 'Services' },
    signaler: { rail: 'Dôme 3', nav: 'Signaler', full: 'Signaler' },
    etat: { rail: 'Serre 1', nav: 'État', full: 'État de la ville' },
    conseil: { rail: 'Tour du Conseil', nav: 'Annonces', full: 'Annonces' },
    observatoire: { rail: 'Observatoire', nav: 'Nova', full: 'Parler à Nova' },
    registre: { rail: "Vue d'ensemble", nav: 'Registre', full: 'Registre' },
  },
  {
    arrivee: { rail: 'Arrival', nav: '', full: '' },
    services: { rail: 'Central Dome', nav: 'Services', full: 'Services' },
    signaler: { rail: 'Dome 3', nav: 'Report', full: 'Report' },
    etat: { rail: 'Greenhouse 1', nav: 'Status', full: 'City status' },
    conseil: { rail: 'Council Tower', nav: 'News', full: 'Announcements' },
    observatoire: { rail: 'Observatory', nav: 'Nova', full: 'Talk to Nova' },
    registre: { rail: 'Overview', nav: 'Registry', full: 'Registry' },
  },
)

export type CitySectionLabels = { rail: string; nav: string; full: string }

/** The sections' labels in the visitor's language (re-renders on a language switch). */
export const useCitySectionLabels = (): Readonly<Record<CitySectionId, CitySectionLabels>> => useMessages(labels)
