import { describe, expect, it } from 'vitest'
import type { ActiveAlert } from '../../api/types'
import { alertWakeMs, pendingTransmissions, periodOf, recommendationsOf, sortAlerts, stepsOf, zoneLabel } from './alertModel'

const alert = (patch: Partial<ActiveAlert>): ActiveAlert =>
  ({
    id: 1,
    title: 'Alerte',
    message: 'Message',
    severity: 'INFO',
    audience: 'ALL',
    districts: [],
    concerns_me: true,
    starts_at: '2026-10-04T10:00:00.000Z',
    ends_at: null,
    recommendations: null,
    instructions: null,
    ...patch,
  }) as ActiveAlert

describe('sortAlerts', () => {
  it('puts what concerns me first, then the most serious, then the most recent', () => {
    const sorted = sortAlerts([
      alert({ id: 1, severity: 'CRITICAL', concerns_me: false }),
      alert({ id: 2, severity: 'INFO' }),
      alert({ id: 3, severity: 'WARNING' }),
      alert({ id: 4, severity: 'WARNING', starts_at: '2026-10-04T12:00:00.000Z' }),
    ])
    expect(sorted.map((a) => a.id)).toEqual([4, 3, 2, 1])
  })
})

describe('zoneLabel', () => {
  it('says who the alert speaks to', () => {
    expect(zoneLabel(alert({}))).toBe('Toute la ville')
    expect(zoneLabel(alert({ audience: 'DISTRICTS', districts: [{ id: 3, code: 'SUD', name: 'Quartier Sud' }] }))).toBe('Quartier Sud')
    expect(zoneLabel(alert({ audience: 'VULNERABLE' }))).toBe('Personnes vulnérables')
  })
})

describe('stepsOf', () => {
  it('splits the instructions into actions, by line or by sentence', () => {
    expect(stepsOf(null)).toEqual([])
    expect(stepsOf('Évitez les berges, montez dans les étages.')).toEqual(['Évitez les berges, montez dans les étages.'])
    expect(stepsOf('Restez chez vous. Fermez les fenêtres. Écoutez la radio.')).toHaveLength(3)
    expect(stepsOf('- Coupez le gaz\n- Sortez par l’escalier')).toEqual(['Coupez le gaz', 'Sortez par l’escalier'])
    expect(stepsOf('1. Rentrez\n2) Fermez')).toEqual(['Rentrez', 'Fermez'])
    expect(stepsOf('16:00 : fermeture des sas.')).toEqual(['16:00 : fermeture des sas.'])
  })
})

describe('recommendationsOf', () => {
  it('reads both the plain and the titled recommendations', () => {
    expect(recommendationsOf(alert({ recommendations: ['Buvez', { title: 'Enfants', text: 'Restez au frais' }, ' '] }))).toEqual([
      { text: 'Buvez' },
      { title: 'Enfants', text: 'Restez au frais' },
    ])
  })
})

describe('alertWakeMs', () => {
  it('wakes when the outage starts or ends, and waits when nothing is ahead', () => {
    const now = Date.parse('2026-10-04T18:00:00.000Z')
    expect(alertWakeMs(now, [now - 1000])).toBeNull()
    expect(alertWakeMs(now, [])).toBeNull()
    expect(alertWakeMs(now, [now + 10_000, now + 60_000])).toBe(10_500)
  })
})

describe('pendingTransmissions', () => {
  it('keeps the alerts that concern me and that I have not acknowledged', () => {
    const alerts = [alert({ id: 1 }), alert({ id: 2, concerns_me: false }), alert({ id: 3 })]
    expect(pendingTransmissions(alerts, [3]).map((a) => a.id)).toEqual([1])
  })
})

describe('periodOf', () => {
  it('writes the period, open-ended when there is no end', () => {
    const now = Date.parse('2026-10-04T10:30:00.000Z')
    expect(periodOf(alert({}), now)).toMatch(/^Depuis \d\d:\d\d · jusqu'à nouvel ordre$/)
    expect(periodOf(alert({ ends_at: '2026-10-06T10:00:00.000Z' }), now)).toMatch(/jusqu'à \w+ \d+ octobre, \d\d:\d\d$/)
  })
})
