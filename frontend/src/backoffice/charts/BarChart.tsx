import { useState } from 'react'
import { motion } from 'motion/react'
import { ChartFrame } from './ChartFrame'
import { useMeasure } from './useMeasure'
import styles from './Charts.module.css'

export interface Bar {
  label: string
  value: number
  /** Colour role; defaults to the first series colour. Status colours always come with their label. */
  color?: string
}

interface BarChartProps {
  bars: Bar[]
  summary: string
  unit?: string
  valueHeader?: string
}

/** Horizontal bars: label on the left, value at the tip, ≤ 20px thick, 4px rounded data end. */
export function BarChart({ bars, summary, unit = '', valueHeader = 'Valeur' }: BarChartProps) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const labelW = Math.min(170, width * 0.38)
  const valueW = 46
  const row = 34
  const thickness = 16
  const height = bars.length * row
  const max = Math.max(...bars.map((b) => b.value), 1)
  const scale = (v: number) => (v / max) * (width - labelW - valueW)

  return (
    <ChartFrame summary={summary} table={{ columns: ['Catégorie', valueHeader], rows: bars.map((b) => [b.label, `${b.value}${unit}`]) }}>
      <div ref={ref} style={{ position: 'relative' }}>
        <svg className={styles.svg} width={width} height={height} onMouseLeave={() => setHover(null)}>
          {bars.map((bar, i) => {
            const y = i * row + (row - thickness) / 2
            const w = Math.max(2, scale(bar.value))
            return (
              <g key={bar.label} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55}>
                <rect className={styles.hit} x={0} y={i * row} width={width} height={row} />
                <text className={styles.label} x={0} y={y + thickness / 2 + 4}>
                  {bar.label.length > 24 ? `${bar.label.slice(0, 23)}…` : bar.label}
                </text>
                <motion.path
                  d={`M${labelW},${y} h${w - 4} q4,0 4,4 v${thickness - 8} q0,4 -4,4 h${-(w - 4)} Z`}
                  style={{ fill: bar.color ?? 'var(--series-1)', originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                />
                <text className={styles.valueLabel} x={labelW + w + 8} y={y + thickness / 2 + 4}>
                  {bar.value}
                  {unit}
                </text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className={styles.tooltip} style={{ left: labelW + scale(bars[hover].value) / 2, top: hover * row + 4 }}>
            <div className={styles.tooltipRow}>
              <span className={styles.swatch} style={{ background: bars[hover].color ?? 'var(--series-1)' }} />
              {bars[hover].label}
              <strong>
                {bars[hover].value}
                {unit}
              </strong>
            </div>
          </div>
        )}
      </div>
    </ChartFrame>
  )
}
