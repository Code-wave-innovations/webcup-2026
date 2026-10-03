import { useEffect, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { formatCompact } from '../lib/format'
import type { Tone } from '../lib/labels'
import { Sparkline } from '../charts/Sparkline'
import { Icon, type IconName } from './Icon'
import { rise } from './motion'
import styles from './StatTile.module.css'

/** Number that counts up to its value with a soft ease-out (instant when motion is reduced). */
export function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const count = useMotionValue(reduced ? value : 0)
  const text = useTransform(count, (v) => formatCompact(Math.round(v)))
  useEffect(() => {
    if (reduced) {
      count.set(value)
      return
    }
    const controls = animate(count, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] })
    return () => controls.stop()
  }, [value, reduced, count])
  return <motion.span>{text}</motion.span>
}

interface StatTileProps {
  label: string
  /** null: nothing to measure yet, shown as a dash */
  value: number | null
  icon: IconName
  tone?: Tone
  /** Signed change vs the previous period, e.g. "+12 % vs semaine dernière". The arrow follows
   *  `direction` (a shorter delay goes down and is good), by default up when good. */
  delta?: { text: string; good: boolean; direction?: 'up' | 'down' | 'flat' }
  trend?: number[]
  hint?: ReactNode
  unit?: string
}

/** KPI tile: label, figure, optional delta and 12-point sparkline. */
export function StatTile({ label, value, icon, tone = 'ice', delta, trend, hint, unit }: StatTileProps) {
  const arrow = delta && (delta.direction ?? (delta.good ? 'up' : 'down'))
  return (
    <motion.div variants={rise} className={[styles.tile, styles[tone]].join(' ')}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={styles.value}>
        {value === null ? '—' : <AnimatedNumber value={value} />}
        {unit && value !== null && <span className={styles.unit}>{unit}</span>}
      </p>
      <div className={styles.bottom}>
        {delta && (
          <span className={delta.good ? styles.good : styles.bad}>
            {arrow !== 'flat' && <Icon name={arrow === 'up' ? 'arrowUp' : 'arrowDown'} size={12} />}
            {delta.text}
          </span>
        )}
        {hint && <span className={styles.hint}>{hint}</span>}
        {trend && (
          <span className={styles.spark}>
            <Sparkline values={trend} label={`Tendance : ${label}`} />
          </span>
        )}
      </div>
    </motion.div>
  )
}
