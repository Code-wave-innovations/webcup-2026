import { useState } from 'react'
import { motion } from 'motion/react'
import { ChartFrame } from './ChartFrame'
import { useMeasure } from './useMeasure'
import styles from './Charts.module.css'

interface Series {
  key: string
  label: string
  /** CSS colour role, e.g. var(--series-1) */
  color: string
  values: number[]
  /** Area wash under the line (~10% opacity). */
  area?: boolean
}

interface AreaTrendProps {
  labels: string[]
  series: Series[]
  summary: string
  height?: number
}

const niceMax = (value: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(value || 1))
  return Math.ceil(value / magnitude) * magnitude
}

/** Lines over time with an area wash, crosshair and tooltip. One y-axis only. */
export function AreaTrend({ labels, series, summary, height = 220 }: AreaTrendProps) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { top: 12, right: 12, bottom: 26, left: 34 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)))
  const x = (i: number) => pad.left + (i / (labels.length - 1)) * innerW
  const y = (v: number) => pad.top + innerH - (v / max) * innerH
  const ticks = [0, max / 2, max]
  const labelEvery = Math.ceil(labels.length / Math.max(2, Math.floor(innerW / 70)))

  return (
    <ChartFrame
      summary={summary}
      table={{ columns: ['Période', ...series.map((s) => s.label)], rows: labels.map((l, i) => [l, ...series.map((s) => s.values[i])]) }}
    >
      <div className={styles.legend}>
        {series.map((s) => (
          <span key={s.key} className={styles.legendItem}>
            <span className={styles.line} style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={ref} style={{ position: 'relative' }}>
        <svg className={styles.svg} width={width} height={height} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={styles.gridLine} x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
              <text className={styles.axis} x={pad.left - 8} y={y(t) + 4} textAnchor="end">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 || i === labels.length - 1 ? (
              <text key={l} className={styles.axis} x={x(i)} y={height - 6} textAnchor="middle">
                {l}
              </text>
            ) : null,
          )}
          {series.map((s, si) => {
            const line = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
            const area = `${line} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
            return (
              <g key={s.key}>
                {s.area && (
                  <motion.path
                    d={area}
                    style={{ fill: s.color }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.1 }}
                    transition={{ duration: 1, delay: 0.4 }}
                  />
                )}
                <motion.path
                  d={line}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.3, delay: si * 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                />
                {/* end label: value at the line's end */}
                <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1])} r={4} style={{ fill: s.color }} stroke="var(--color-void)" strokeWidth={2} />
              </g>
            )
          })}
          {hover !== null && (
            <g>
              <line className={styles.crosshair} x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={5} style={{ fill: s.color }} stroke="var(--color-void)" strokeWidth={2} />
              ))}
            </g>
          )}
          {labels.map((l, i) => (
            <rect
              key={l}
              className={styles.hit}
              x={x(i) - innerW / labels.length / 2}
              y={pad.top}
              width={innerW / labels.length}
              height={innerH}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div className={styles.tooltip} style={{ left: x(hover), top: Math.min(...series.map((s) => y(s.values[hover]))) }}>
            <div className={styles.tooltipTitle}>{labels[hover]}</div>
            {series.map((s) => (
              <div key={s.key} className={styles.tooltipRow}>
                <span className={styles.line} style={{ background: s.color }} />
                {s.label}
                <strong>{s.values[hover]}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  )
}
