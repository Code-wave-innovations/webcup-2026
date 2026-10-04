/** A service as the usage reading needs it (F28). */
export interface UsageService {
  id: number
  name: string
  view_count: number
  is_featured: boolean
  is_active: boolean
}

export interface UsageRank {
  id: number
  name: string
  views: number
  /** Share of all consultations of services still in the catalogue, rounded. */
  share: number
  featured: boolean
}

export interface ServiceUsage {
  total: number
  /** Catalogue services that have been opened at least once, most consulted first. */
  ranked: UsageRank[]
  /** What the figures mean, in one or two sentences. */
  reading: string
  /** What to change on the home page, when the ranking and the featuring disagree. */
  action: string | null
}

const TOP = 5

function consultations(count: number): string {
  const formatted = new Intl.NumberFormat('fr-FR').format(count)
  return `${formatted} consultation${count > 1 ? 's' : ''}`
}

function shareOf(views: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((views / total) * 100)
}

/**
 * F28: which catalogue services residents actually open, and whether the home page
 * features the same ones. Withdrawn services are left out: they are no longer offered.
 */
export function serviceUsage(services: UsageService[]): ServiceUsage {
  const offered = services.filter((service) => service.is_active)
  const total = offered.reduce((sum, service) => sum + service.view_count, 0)
  const ranked = offered
    .filter((service) => service.view_count > 0)
    .sort((a, b) => b.view_count - a.view_count || a.name.localeCompare(b.name, 'fr'))
    .map((service) => ({
      id: service.id,
      name: service.name,
      views: service.view_count,
      share: shareOf(service.view_count, total),
      featured: service.is_featured,
    }))

  if (total === 0 || ranked.length === 0) {
    return { total: 0, ranked: [], reading: 'Aucune consultation d’habitant pour l’instant.', action: null }
  }

  const lead = ranked[0]
  const groupShare = ranked.slice(0, 3).reduce((sum, service) => sum + service.share, 0)
  const concentration = ranked.length > 3 ? ` Les trois premiers réunissent ${groupShare} % des consultations.` : ''
  const reading =
    ranked.length === 1
      ? `${lead.name} est le seul service consulté par les habitants : ${consultations(lead.views)}.`
      : `${lead.name} est le service le plus consulté : ${consultations(lead.views)}, soit ${lead.share} % du total.${concentration}`

  return { total, ranked: ranked.slice(0, TOP), reading, action: actionFor(ranked, offered) }
}

function actionFor(ranked: UsageRank[], offered: UsageService[]): string | null {
  const lead = ranked[0]
  if (!lead.featured) {
    return `${lead.name} n’est pas mis en avant sur l’accueil, alors que c’est le service que les habitants ouvrent le plus.`
  }
  const overlooked = ranked.slice(1, 3).find((service) => !service.featured && service.share >= 15)
  if (overlooked) {
    return `${overlooked.name} réunit ${overlooked.share} % des consultations sans être mis en avant sur l’accueil.`
  }
  const quiet = offered.filter((service) => service.is_featured && service.view_count === 0)
  if (quiet.length === 1) return `${quiet[0].name} est mis en avant sur l’accueil, sans consultation pour l’instant.`
  if (quiet.length > 1) return `${quiet.length} services mis en avant n’ont encore aucune consultation.`
  return null
}
