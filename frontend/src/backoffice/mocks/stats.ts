// Aggregated series for the supervision charts (simulated, deterministic).

const DAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

/** Requests received vs resolved over the last 14 days. */
export const REQUEST_TREND = Array.from({ length: 14 }, (_, i) => {
  const received = Math.round(18 + 9 * Math.sin(i / 2.1) + i * 1.4)
  const resolved = Math.round(received * (0.62 + 0.2 * Math.cos(i / 3)))
  return { label: `J-${13 - i}`, received, resolved }
})

/** Platform activity (logins + actions) by weekday × hour block, 0..1. */
export const ACTIVITY_HEATMAP = DAYS.map((day, d) => ({
  day,
  values: Array.from({ length: 12 }, (_, h) => {
    const hour = h * 2
    const office = hour >= 8 && hour <= 18 ? 1 : 0.25
    const weekend = d >= 5 ? 0.55 : 1
    const peak = Math.exp(-((hour - 11) ** 2) / 18) * 0.5
    return Math.min(1, Math.round((office * weekend * (0.35 + peak) + ((d * 7 + h * 3) % 5) * 0.04) * 100) / 100)
  }),
}))

export const HEATMAP_HOURS = Array.from({ length: 12 }, (_, h) => `${String(h * 2).padStart(2, '0')}h`)

/** Weekly sparkline series for stat tiles. */
export const SPARKS = {
  awaiting: [3, 5, 4, 7, 6, 8, 5, 6, 9, 7, 6, 5],
  resolved: [4, 6, 5, 8, 9, 7, 10, 12, 11, 13, 12, 14],
  citizens: [820, 860, 905, 940, 990, 1030, 1080, 1120, 1150, 1190, 1215, 1240],
  appointments: [6, 8, 7, 9, 11, 10, 12, 9, 13, 12, 14, 15],
  delay: [26, 24, 25, 22, 21, 22, 19, 18, 18, 17, 16, 15],
}

/** Average handling time (hours) per service, last 30 days. */
export const HANDLING_TIME = [
  { label: 'Éclairage & voirie', value: 31 },
  { label: 'Propreté', value: 22 },
  { label: 'État civil', value: 18 },
  { label: 'Eau & énergie', value: 14 },
  { label: 'Centre de santé', value: 6 },
]
