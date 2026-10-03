import type { Tone } from '../../ui/Badges'

export const CATEGORIES = ['Transports', 'Sécurité', 'Environnement', 'Vie quotidienne'] as const
export const SECTORS = ['Dôme 1', 'Dôme 2', 'Dôme 3', 'Dôme 4', 'Serre 1', 'Anneau nord'] as const
export const URGENCIES = ['Faible', 'Moyenne', 'Haute'] as const

export type Category = (typeof CATEGORIES)[number]
export type Sector = (typeof SECTORS)[number]
export type Urgency = (typeof URGENCIES)[number]

/** Life of a report, from the moment it reaches the High Council to its resolution. */
export const STATUSES: ReadonlyArray<{ name: string; tone: Tone; note: string; councilAction?: string }> = [
  { name: 'Reçue', tone: 'alert', note: 'Demande enregistrée.', councilAction: 'Prendre en charge' },
  { name: 'Prise en charge', tone: 'progress', note: 'Un service a pris votre demande.', councilAction: "Démarrer l'intervention" },
  { name: 'En cours', tone: 'progress', note: 'Équipe sur place.', councilAction: 'Marquer résolue' },
  { name: 'Résolue', tone: 'ok', note: 'Problème réglé.' },
]

export type ReportStatus = 0 | 1 | 2 | 3
export const RESOLVED: ReportStatus = 3

export interface Report {
  code: string
  title: string
  category: Category
  sector: Sector
  urgency: Urgency
  status: ReportStatus
  /** local time of each status reached, by status index */
  times: string[]
}

export const MIN_REPORT_LENGTH = 6
export const TITLE_LENGTH = 90
