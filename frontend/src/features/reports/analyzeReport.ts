import { SECTORS, type Category, type Sector, type Urgency } from './reportModel'

export interface ReportSuggestion {
  category: Category
  sector: Sector
  urgency: Urgency
}

const isSector = (value: string): value is Sector => (SECTORS as readonly string[]).includes(value)

/**
 * NOVA's keyword reading of a report: proposes a category, a sector and an urgency the visitor can
 * correct. Later rules win (a fire on the ring road is a safety matter before a transport one).
 */
export function analyzeReport(text: string, currentSector: Sector): ReportSuggestion {
  const t = text.toLowerCase()
  let category: Category = 'Vie quotidienne'
  let sector: Sector = currentSector
  let urgency: Urgency = 'Moyenne'

  if (/\bsas\b|porte|badge|intrus|bloqu/.test(t)) category = 'Sécurité'
  if (/navette|\bbus\b|transport|anneau|borne|retard|pont/.test(t)) category = 'Transports'
  if (/\beau\b|fuite|\bair\b|serre|odeur|énergie|energie|capteur/.test(t)) category = 'Environnement'
  if (/danger|\bfeu\b|incendie|fumée|fumee/.test(t)) category = 'Sécurité'

  const dome = t.match(/d[oô]me\s*(\d)/)
  if (dome && isSector(`Dôme ${dome[1]}`)) sector = `Dôme ${dome[1]}` as Sector
  if (/serre/.test(t)) sector = 'Serre 1'
  if (/anneau|pont/.test(t)) sector = 'Anneau nord'

  if (/fuite|danger|\bfeu\b|incendie|fumée|fumee|bloqu|urgent|depuis ce matin/.test(t)) urgency = 'Haute'

  return { category, sector, urgency }
}
