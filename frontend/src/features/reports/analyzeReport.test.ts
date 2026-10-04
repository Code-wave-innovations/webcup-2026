import { describe, expect, it } from 'vitest'
import { analyzeReport, type NamedDistrict } from './analyzeReport'
import { anchorForDistrict } from './districtAnchor'
import { photoError, reportSubject, signalForStatus } from './reportModel'

const DISTRICTS: NamedDistrict[] = [
  { id: 1, code: 'CENTRE', name: 'Centre-Ville' },
  { id: 2, code: 'NORD', name: 'Quartier Nord' },
  { id: 3, code: 'SUD', name: 'Quartier Sud' },
  { id: 4, code: 'EST', name: 'Quartier Est' },
  { id: 5, code: 'OUEST', name: 'Quartier Ouest' },
]

describe('analyzeReport', () => {
  it('reads a broken street light in the south district', () => {
    expect(analyzeReport('Lampadaire cassé devant le 12 rue des Lilas, quartier sud.', DISTRICTS)).toEqual({
      category: 'Éclairage public',
      districtId: 3,
      urgency: 'NORMAL',
    })
  })

  it('does not take the verb « est » for the east district', () => {
    expect(analyzeReport('Le lampadaire est cassé devant chez moi.', DISTRICTS).districtId).toBeNull()
  })

  it('reads a water leak in the west as urgent since this morning', () => {
    expect(analyzeReport("Fuite d'eau dans le quartier ouest, depuis ce matin.", DISTRICTS)).toEqual({
      category: 'Eau et énergie',
      districtId: 5,
      urgency: 'HIGH',
    })
  })

  it('places a late shuttle in the centre', () => {
    expect(analyzeReport('La navette du centre-ville a du retard', DISTRICTS)).toEqual({
      category: 'Transports',
      districtId: 1,
      urgency: 'NORMAL',
    })
  })

  it('treats fire as a safety matter even on the transport network', () => {
    expect(analyzeReport('Fumée dans le bus du nord', DISTRICTS)).toMatchObject({ category: 'Sécurité', districtId: 2, urgency: 'HIGH' })
  })

  it('keeps the district unset when the sentence names none', () => {
    expect(analyzeReport('Le distributeur ne rend pas la monnaie', DISTRICTS)).toEqual({
      category: 'Autre',
      districtId: null,
      urgency: 'NORMAL',
    })
  })
})

describe('report mapping', () => {
  it('lights the beam for each district and turns it off when refused', () => {
    expect(anchorForDistrict('CENTRE')).toBe('central')
    expect(anchorForDistrict('OUEST')).toBe('serre')
    expect(anchorForDistrict('SUD')).toBe('pont')
    expect(anchorForDistrict(null)).toBe('trois')
    expect(signalForStatus('SUBMITTED').beam).toBe(0)
    expect(signalForStatus('IN_PROGRESS').beam).toBe(2)
    expect(signalForStatus('RESOLVED').beam).toBe(3)
    expect(signalForStatus('REJECTED').beam).toBe(-1)
  })

  it('builds a subject the API accepts', () => {
    expect(reportSubject('  lampadaire cassé devant le 12  ')).toBe('Lampadaire cassé devant le 12')
  })

  it('refuses a photo that is not an image or that is too heavy', () => {
    expect(photoError(new File(['x'], 'note.pdf', { type: 'application/pdf' }))).toMatch(/JPG/)
    expect(photoError(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' }))).toMatch(/10 Mo/)
    expect(photoError(new File(['x'], 'ok.png', { type: 'image/png' }))).toBeNull()
  })
})
