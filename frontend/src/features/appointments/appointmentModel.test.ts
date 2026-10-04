import { describe, expect, it } from 'vitest'
import type { AppointmentSlot } from '../../api/types'
import { cityDay, closedReason, countdown, dayCell, dayPart, groupByDay, nextDays, reminderPlan } from './appointmentModel'

const TZ = 'Indian/Antananarivo' // UTC+3, no daylight saving

describe('city days', () => {
  it('reads the day in the city, not in the browser', () => {
    // 22:30 UTC on the 4th is already the 5th in Terra Nova
    expect(cityDay(Date.parse('2026-10-04T22:30:00Z'), TZ)).toBe('2026-10-05')
    expect(cityDay(Date.parse('2026-10-04T20:30:00Z'), TZ)).toBe('2026-10-04')
  })

  it('lists the next 14 days from the city’s today, with their names', () => {
    const days = nextDays(Date.parse('2026-10-04T22:30:00Z'), TZ)
    expect(days).toHaveLength(14)
    expect(days[0]).toMatchObject({ key: '2026-10-05', dow: 1, label: 'lundi 5 octobre 2026' })
    expect(days[13].key).toBe('2026-10-18')
  })

  it('says why a day cannot be chosen', () => {
    const slot = { day: '2026-10-05' } as AppointmentSlot
    expect(closedReason(dayCell('2026-10-04'), undefined)).toBe('Fermé le dimanche')
    expect(closedReason(dayCell('2026-10-06'), [])).toBe('Complet')
    expect(closedReason(dayCell('2026-10-05'), [slot])).toBeNull()
    const interrupted = { ...slot, blocked: { reason: 'Maintenance', alternative: null, back_at: null } }
    expect(closedReason(dayCell('2026-10-05'), [interrupted])).toBe('Service interrompu')
  })

  it('groups the slots by the city’s day, in time order', () => {
    const at = (id: number, day: string, starts_at: string) => ({ id, day, starts_at }) as AppointmentSlot
    const days = groupByDay([at(2, '2026-10-05', '2026-10-05T08:00:00Z'), at(1, '2026-10-05', '2026-10-05T06:00:00Z'), at(3, '2026-10-06', '2026-10-06T06:00:00Z')])
    expect(days.get('2026-10-05')?.map((s) => s.id)).toEqual([1, 2])
    expect([...days.keys()]).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('splits a day into morning, afternoon and evening', () => {
    expect(dayPart('09:30')).toBe('Matin')
    expect(dayPart('14:00')).toBe('Après-midi')
    expect(dayPart('18:30')).toBe('Soir')
  })
})

describe('reminderPlan (F40)', () => {
  const start = '2026-10-07T06:30:00Z' // 09:30 in Terra Nova

  it('says when the reminder goes, in the city’s time', () => {
    expect(reminderPlan(start, 1440, TZ, Date.parse('2026-10-04T10:00:00Z'))).toEqual({ when: 'mardi 6 octobre à 09:30', immediate: false })
  })

  it('knows when the reminder moment has already passed, and when there is none', () => {
    expect(reminderPlan(start, 1440, TZ, Date.parse('2026-10-06T08:00:00Z')).immediate).toBe(true)
    expect(reminderPlan(start, null, TZ, 0)).toEqual({ when: null, immediate: false })
  })
})

describe('countdown', () => {
  it('reads the time left in words', () => {
    const now = Date.parse('2026-10-04T10:00:00Z')
    expect(countdown('2026-10-04T10:20:00Z', now)).toBe('dans 20 minutes')
    expect(countdown('2026-10-04T13:00:00Z', now)).toBe('dans 3 heures')
    expect(countdown('2026-10-06T10:00:00Z', now)).toBe('après-demain')
  })
})
