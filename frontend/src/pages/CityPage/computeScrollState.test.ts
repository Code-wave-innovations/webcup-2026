import { describe, expect, it } from 'vitest'
import { computeScrollState, type SectionMetrics } from './computeScrollState'

const SCREEN = 800
// desktop layout: the arrival frame is 1.7 screens tall, the others 2.1 screens
const sections: SectionMetrics[] = [0, 1360, 3040, 4720].map((top, i) => ({ top, height: i ? 1680 : 1360, columnTop: 0 }))
const desktop = { phone: false, reduced: false }

describe('computeScrollState', () => {
  it('rests on the arrival at the top of the page', () => {
    const state = computeScrollState(0, SCREEN, sections, desktop)
    expect(state.u).toBe(0)
    expect(state.active).toBe(0)
    expect(state.reveals[0]).toBe(1)
  })

  it('flies between two districts in the gap between their frames', () => {
    const leave = sections[0].top + sections[0].height - 1.45 * SCREEN
    const arrive = sections[1].top - 0.05 * SCREEN
    expect(computeScrollState(leave, SCREEN, sections, desktop).u).toBeCloseTo(0)
    expect(computeScrollState((leave + arrive) / 2, SCREEN, sections, desktop).u).toBeCloseTo(0.5)
    expect(computeScrollState(arrive, SCREEN, sections, desktop).u).toBeCloseTo(1)
  })

  it('never goes past the last pose', () => {
    expect(computeScrollState(1e6, SCREEN, sections, desktop).u).toBe(3)
  })

  it('reveals panels fully or not at all with reduced motion', () => {
    const state = computeScrollState(sections[1].top - 0.3 * SCREEN, SCREEN, sections, { phone: false, reduced: true })
    for (const reveal of state.reveals) expect([0, 1]).toContain(reveal)
  })

  it('on a phone, reads the last column that came into view (those above stay revealed)', () => {
    const phone = [-1500, -200, 900].map((columnTop, i) => ({ top: i * 1400, height: 1400, columnTop }))
    const state = computeScrollState(1800, SCREEN, phone, { phone: true, reduced: false })
    expect(state.reveals.slice(0, 2)).toEqual([1, 1])
    expect(state.active).toBe(1)
  })
})
