import type { UrgencyHint } from '../../api/requests'
import type { Category } from './reportModel'

export interface NamedDistrict {
  id: number
  code: string
  name: string
}

export interface ReportSuggestion {
  category: Category
  /** null: the sentence names no known district, so the current choice stays */
  districtId: number | null
  urgency: UrgencyHint
}

const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** District names and the words people actually use ("quartier sud", "centre-ville", "serres"), in French and English (D14). */
const DISTRICT_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/centre[-\s]?ville|\bcentre\b|\bcenter\b|downtown/, 'CENTRE'],
  [/quartier\s+sud|\bsud\b|\bsouth\b/, 'SUD'],
  [/quartier\s+nord|\bnord\b|\bnorth\b/, 'NORD'],
  [/quartier\s+est|\bl['’]est\b|\bcote\s+est\b|\beast\b/, 'EST'],
  [/quartier\s+ouest|\bouest\b|\bserre\b|\bwest\b|greenhouse/, 'OUEST'],
]

function matchDistrict(text: string, districts: readonly NamedDistrict[]): number | null {
  for (const [pattern, code] of DISTRICT_RULES) {
    if (!pattern.test(text)) continue
    const found = districts.find((district) => district.code === code)
    if (found) return found.id
  }
  for (const district of districts) {
    const name = fold(district.name)
    if (name.length > 3 && text.includes(name)) return district.id
  }
  return null
}

/**
 * NOVA's keyword reading of a report: proposes a category, a district and an urgency the visitor can
 * correct. Later rules win (a fire on a bus is a safety matter before a transport one).
 * "est" as a verb ("le lampadaire est cassé") is not the east district.
 */
export function analyzeReport(text: string, districts: readonly NamedDistrict[]): ReportSuggestion {
  const t = fold(text)
  let category: Category = 'Autre'
  let urgency: UrgencyHint = 'NORMAL'

  if (/dechet|ordure|proprete|poubelle|rubbish|litter|trash|waste|\bbins?\b/.test(t)) category = 'Propreté et déchets'
  if (/voirie|nid de poule|trottoir|chaussee|pothole|pavement|sidewalk|\broad\b/.test(t)) category = 'Voirie'
  if (/lampadaire|eclairage|reverber|lumiere|luminaire|street\s?light|lamp|lighting/.test(t)) category = 'Éclairage public'
  if (/navette|\bbus\b|transport|tram|retard|shuttle|\blate\b|delay/.test(t)) category = 'Transports'
  if (/\beau\b|fuite|energie|electricite|coupure|\bwater\b|\bleak|energy|electric|power cut|outage/.test(t)) category = 'Eau et énergie'
  if (/\bsas\b|badge|intrus|securite|agression|bloqu|airlock|security|assault|\bstuck\b|blocked/.test(t)) category = 'Sécurité'
  if (/danger|\bfeu\b|incendie|fumee|\bfire\b|smoke/.test(t)) category = 'Sécurité'

  if (/mineur|pas urgent|quand vous pouvez|minor|not urgent|no rush|when you can/.test(t)) urgency = 'LOW'
  if (/fuite|danger|\bfeu\b|incendie|fumee|urgent|depuis ce matin|inond|\bleak|\bfire\b|smoke|since this morning|flood/.test(t)) urgency = 'HIGH'

  return { category, districtId: matchDistrict(t, districts), urgency }
}
