import { clamp, smoothstep } from '../../lib/math'

/** Geometry of one section of the city page, in document pixels (the column top is viewport-relative). */
export interface SectionMetrics {
  top: number
  height: number
  columnTop: number
}

export interface ScrollState {
  /** camera progress on the flyover path: i = resting on section i, fractions in between */
  u: number
  /** how much each section's text column is revealed (0 → 1) */
  reveals: number[]
  /** the most revealed section */
  active: number
}

interface ScrollOptions {
  phone: boolean
  reduced: boolean
}

/**
 * Maps the scroll position to the camera path and the panels' reveal. On desktop each section is a sticky
 * frame: the camera rests while its text is read and flies to the next district in the gap between frames.
 * On phones the panels simply follow their column into view.
 */
export function computeScrollState(y: number, screen: number, sections: readonly SectionMetrics[], { phone, reduced }: ScrollOptions): ScrollState {
  const flightEnd = phone ? 1.2 : 1.45
  const flightStart = phone ? 0.4 : 0.05
  let u = 0
  let active = 0
  let best = -1
  const reveals = sections.map((section, i) => {
    const next = sections[i + 1]
    if (y >= section.top - flightStart * screen) {
      u = i
      if (next) {
        const leave = section.top + section.height - flightEnd * screen
        const arrive = next.top - flightStart * screen
        u = i + clamp((y - leave) / Math.max(1, arrive - leave), 0, 1)
      }
    }
    let reveal = phone
      ? smoothstep(screen * 0.98, screen * 0.7, section.columnTop)
      : (i ? smoothstep(section.top - 0.55 * screen, section.top - 0.05 * screen, y) : 1) *
        (next ? 1 - smoothstep(section.top + section.height - 1.45 * screen, section.top + section.height - screen, y) : 1)
    if (reduced) reveal = reveal > 0.5 || phone ? 1 : 0
    if (reveal > best) {
      best = reveal
      active = i
    }
    return reveal
  })
  return { u, reveals, active }
}
