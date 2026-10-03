import { useEffect, useState, type CSSProperties } from 'react'
import { clamp } from '../../lib/math'
import { CountUp } from '../../ui/CountUp'
import text from '../../ui/text.module.css'
import styles from './CityGauges.module.css'

const INITIAL = [
  { name: 'Air', level: 98 },
  { name: 'Eau', level: 76 },
  { name: 'Énergie', level: 84 },
]
const DRIFT_MS = 6000

/** Air, water and energy reserves, readable at a glance (simulated: they drift by a point every few seconds). */
export function CityGauges({ visible }: { visible: boolean }) {
  const [started, setStarted] = useState(false)
  const [gauges, setGauges] = useState(INITIAL)
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
        <h3>État de la ville</h3>
        <span className={text.note}>Données simulées</span>
      </div>
      <div className={styles.gauges}>
        {gauges.map((g) => (
          <div key={g.name} className={styles.gauge}>
            <b>
              <CountUp value={g.level} start={started} />
              <small>%</small>
            </b>
            <span>{g.name}</span>
            <i style={{ '--level': started ? `${g.level}%` : '0%' } as CSSProperties} />
          </div>
        ))}
      </div>
    </>
  )
}
