import { motion } from 'motion/react'
import { AnimatedNumber } from '../ui/StatTile'
import styles from './Charts.module.css'

interface RadialGaugeProps {
  value: number
  max: number
  label: string
  /** Severity of the fill: accent, warning or danger. */
  tone: 'ice' | 'ember' | 'alert'
  /** Points (0..1 angle, 0..1 radius) shown as radar blips: one per waiting item. */
  blips?: { angle: number; radius: number; urgent?: boolean }[]
}

const TONE = { ice: 'var(--color-ice)', ember: 'var(--color-ember)', alert: 'var(--color-alert)' }

/** D17 headline figure as a radar: sweeping beam, blips for waiting requests, arc filled by load. */
export function RadialGauge({ value, max, label, tone, blips = [] }: RadialGaugeProps) {
  const size = 200
  const c = size / 2
  const radius = 84
  const arc = 2 * Math.PI * radius
  const ratio = Math.min(1, value / Math.max(max, 1))
  return (
    <div className={styles.root} style={{ maxWidth: 240, margin: '0 auto' }}>
      <div style={{ position: 'relative', aspectRatio: '1' }} role="img" aria-label={`${label} : ${value} sur ${max}`}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" aria-hidden="true">
          <defs>
            <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--color-ice)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--color-ice)" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {[0.33, 0.66, 1].map((r) => (
            <circle key={r} cx={c} cy={c} r={radius * r} fill="none" stroke="var(--color-line-thin)" strokeWidth={1} />
          ))}
          <line x1={c - radius} x2={c + radius} y1={c} y2={c} stroke="var(--color-line-thin)" />
          <line y1={c - radius} y2={c + radius} x1={c} x2={c} stroke="var(--color-line-thin)" />
          <g className={styles.sweep}>
            <path d={`M${c},${c} L${c + radius},${c} A${radius},${radius} 0 0 0 ${c + radius * Math.cos(-0.7)},${c + radius * Math.sin(-0.7)} Z`} fill="url(#beam)" />
          </g>
          {blips.map((b, i) => {
            const a = b.angle * 2 * Math.PI
            return (
              <rect
                key={i}
                className={styles.blip}
                x={c + Math.cos(a) * radius * b.radius - 3}
                y={c + Math.sin(a) * radius * b.radius - 3}
                width={6}
                height={6}
                transform={`rotate(45 ${c + Math.cos(a) * radius * b.radius} ${c + Math.sin(a) * radius * b.radius})`}
                style={{ fill: b.urgent ? 'var(--color-alert)' : 'var(--color-ember)', animationDelay: `${i * 0.3}s` }}
              />
            )
          })}
          <circle cx={c} cy={c} r={radius + 8} fill="none" stroke="var(--color-line-thin)" strokeWidth={4} />
          <motion.circle
            cx={c}
            cy={c}
            r={radius + 8}
            fill="none"
            stroke={TONE[tone]}
            strokeWidth={4}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
            strokeDasharray={`${arc} ${arc}`}
            initial={{ strokeDashoffset: arc }}
            animate={{ strokeDashoffset: arc * (1 - ratio) }}
            transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${TONE[tone]})` }}
          />
        </svg>
        <div className={styles.center}>
          <span className={styles.centerValue}>
            <AnimatedNumber value={value} />
          </span>
          <span className={styles.centerLabel}>{label}</span>
        </div>
      </div>
    </div>
  )
}
