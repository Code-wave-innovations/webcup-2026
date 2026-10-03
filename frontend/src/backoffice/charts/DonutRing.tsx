import { useState } from 'react'
import { motion } from 'motion/react'
import { ChartFrame } from './ChartFrame'
import styles from './Charts.module.css'

interface Slice {
  label: string
  value: number
  color: string
}

/** Part-to-whole ring (≤ 3 slices, validated categorical order), 2px surface gaps, legend with values. */
export function DonutRing({ slices, summary, centerLabel }: { slices: Slice[]; summary: string; centerLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1
  const size = 180
  const radius = 72
  const stroke = 18
  const circumference = 2 * Math.PI * radius
  const gap = 3
  const lengths = slices.map((slice) => (slice.value / total) * circumference)
  const arcs = slices.map((slice, i) => ({
    ...slice,
    length: Math.max(0, lengths[i] - gap),
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }))
  const shown = hover === null ? null : slices[hover]

  return (
    <ChartFrame
      summary={summary}
      table={{ columns: ['Catégorie', 'Nombre', 'Part'], rows: slices.map((s) => [s.label, s.value, `${Math.round((s.value / total) * 100)} %`]) }}
    >
      <div className={styles.donutWrap}>
        <div style={{ position: 'relative', width: '100%', maxWidth: size, aspectRatio: '1' }}>
          <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" onMouseLeave={() => setHover(null)}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line-thin)" strokeWidth={stroke} />
            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {arcs.map((arc, i) => (
                <motion.circle
                  key={arc.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  style={{ stroke: arc.color }}
                  strokeWidth={hover === i ? stroke + 4 : stroke}
                  strokeDasharray={`${arc.length} ${circumference}`}
                  strokeDashoffset={-arc.offset}
                  initial={{ opacity: 0, strokeDasharray: `0 ${circumference}` }}
                  animate={{ opacity: 1, strokeDasharray: `${arc.length} ${circumference}` }}
                  transition={{ duration: 0.9, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                  onMouseEnter={() => setHover(i)}
                />
              ))}
            </g>
          </svg>
          <div className={styles.center}>
            <span className={styles.centerValue}>{shown ? shown.value : total}</span>
            <span className={styles.centerLabel}>{shown ? shown.label : centerLabel}</span>
          </div>
        </div>
        <ul className={styles.donutLegend}>
          {slices.map((slice, i) => (
            <li key={slice.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span className={styles.swatch} style={{ background: slice.color }} />
              <span>{slice.label}</span>
              <strong>
                {slice.value} <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>· {Math.round((slice.value / total) * 100)} %</span>
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  )
}
