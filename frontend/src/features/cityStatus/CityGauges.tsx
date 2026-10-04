import { useEffect, useState, type CSSProperties } from 'react'
import { defineMessages, useMessages } from '../../i18n'
import { clamp } from '../../lib/math'
import { CountUp } from '../../ui/CountUp'
import text from '../../ui/text.module.css'
import styles from './CityGauges.module.css'

const messages = defineMessages(
  { title: 'État de la ville', simulated: 'Données simulées', gauges: { air: 'Air', water: 'Eau', energy: 'Énergie' } },
  { title: 'City status', simulated: 'Simulated data', gauges: { air: 'Air', water: 'Water', energy: 'Energy' } },
)

const INITIAL: ReadonlyArray<{ id: 'air' | 'water' | 'energy'; level: number }> = [
  { id: 'air', level: 98 },
  { id: 'water', level: 76 },
  { id: 'energy', level: 84 },
]
const DRIFT_MS = 6000

/** Air, water and energy reserves, readable at a glance (simulated: they drift by a point every few seconds). */
export function CityGauges({ visible }: { visible: boolean }) {
  const [started, setStarted] = useState(false)
  const [gauges, setGauges] = useState(INITIAL)
  const m = useMessages(messages)
  if (visible && !started) setStarted(true)

  useEffect(() => {
    if (!started) return
    const timer = setInterval(() => {
      if (document.hidden) return
      setGauges((current) => current.map((g) => ({ ...g, level: clamp(g.level + Math.round(Math.random() * 2 - 1), 60, 99) })))
    }, DRIFT_MS)
    return () => clearInterval(timer)
  }, [started])

  return (
    <>
      <div className={styles.header}>
        <h3>{m.title}</h3>
        <span className={text.note}>{m.simulated}</span>
      </div>
      <div className={styles.gauges}>
        {gauges.map((g) => (
          <div key={g.id} className={styles.gauge}>
            <b>
              <CountUp value={g.level} start={started} />
              <small>%</small>
            </b>
            <span>{m.gauges[g.id]}</span>
            <i style={{ '--level': started ? `${g.level}%` : '0%' } as CSSProperties} />
          </div>
        ))}
      </div>
    </>
  )
}
