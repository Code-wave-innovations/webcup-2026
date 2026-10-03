import { describe, expect, it } from 'vitest'
import { analyzeReport } from './analyzeReport'

describe('analyzeReport', () => {
  it('reads the example of the form: a water leak near dome 3 since this morning', () => {
    expect(analyzeReport("Fuite d'eau près du sas du dôme 3, depuis ce matin.", 'Dôme 1')).toEqual({
      category: 'Environnement',
      sector: 'Dôme 3',
      urgency: 'Haute',
    })
  })

  it('places transport problems on the north ring', () => {
    expect(analyzeReport('La navette du pont a du retard', 'Dôme 3')).toEqual({ category: 'Transports', sector: 'Anneau nord', urgency: 'Moyenne' })
  })

  it('treats fire as a safety matter even on the transport network', () => {
    expect(analyzeReport("Fumée sur l'anneau", 'Dôme 3').category).toBe('Sécurité')
  })

  it('keeps the current sector when the text names an unknown dome', () => {
    expect(analyzeReport('Lumière cassée au dôme 9', 'Dôme 2').sector).toBe('Dôme 2')
  })

  it('defaults to daily life with a medium urgency', () => {
    expect(analyzeReport('Le distributeur ne rend pas la monnaie', 'Dôme 4')).toEqual({ category: 'Vie quotidienne', sector: 'Dôme 4', urgency: 'Moyenne' })
  })
})
