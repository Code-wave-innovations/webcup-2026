import { motion } from 'motion/react'

/** 12-point trend line for stat tiles (decorative de-emphasis, last point accented). */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 84
  const height = 24
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)])
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label={label}>
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <circle cx={lx} cy={ly} r={3} fill="currentColor" stroke="var(--color-void)" strokeWidth={1.5} />
    </svg>
  )
}
