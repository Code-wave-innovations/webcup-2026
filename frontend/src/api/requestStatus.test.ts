import { describe, expect, it } from 'vitest'
import {
  CITIZEN_STATUS_LABEL,
  FRISE_STEPS,
  friseIndex,
  friseTone,
  nextStepHint,
  isOpenStatus,
} from './requestStatus'

describe('requestStatus', () => {
  it('exposes citizen-facing labels without raw codes', () => {
    expect(CITIZEN_STATUS_LABEL.IN_REVIEW).toBe('En examen')
    expect(CITIZEN_STATUS_LABEL.WAITING_CITIZEN).toBe('Votre réponse est attendue')
    expect(FRISE_STEPS).toHaveLength(4)
  })

  it('maps statuses onto the frise', () => {
    expect(friseIndex('SUBMITTED')).toBe(0)
    expect(friseIndex('IN_REVIEW')).toBe(1)
    expect(friseIndex('IN_PROGRESS')).toBe(2)
    expect(friseIndex('WAITING_CITIZEN')).toBe(2)
    expect(friseIndex('RESOLVED')).toBe(3)
    expect(friseIndex('CLOSED')).toBe(3)
    expect(friseIndex('REJECTED')).toBe(3)
    expect(friseTone('WAITING_CITIZEN')).toBe('waiting')
    expect(friseTone('REJECTED')).toBe('rejected')
    expect(friseTone('RESOLVED')).toBe('done')
  })

  it('gives a next-step hint and open/closed', () => {
    expect(nextStepHint('SUBMITTED')).toMatch(/prendre en charge/i)
    expect(nextStepHint('WAITING_CITIZEN')).toMatch(/réponse|répond/i)
    expect(isOpenStatus('IN_PROGRESS')).toBe(true)
    expect(isOpenStatus('CLOSED')).toBe(false)
    expect(isOpenStatus('REJECTED')).toBe(false)
  })
})
