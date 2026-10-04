import { useState } from 'react'
import { ChartFrame } from './ChartFrame'
import styles from './Charts.module.css'

interface HeatmapProps {
  rows: { day: string; values: number[] }[]
  columns: string[]
  summary: string
}

/** Sequential single hue (cyan), low values receding toward the surface. Per-cell tooltip. */
export function Heatmap({ rows, columns, summary }: HeatmapProps) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)
  const cell = (v: number) => {
    // one hue, light→dark on the dark surface: brighter = more activity
    const alpha = 0.08 + v * 0.85
    return v > 0.85 ? '#c8f6ff' : `rgba(42, 159, 208, ${alpha.toFixed(2)})`
  }
  return (
    <ChartFrame
      summary={summary}
      table={{ columns: ['Jour', ...columns], rows: rows.map((r) => [r.day, ...r.values.map((v) => `${Math.round(v * 100)} %`)]) }}
    >
      <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
        <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(${columns.length}, minmax(0, 1fr))`, gap: 2 }}>
          <span />
          {columns.map((c, i) => (
            <span key={c} className={styles.axis} style={{ fontSize: 12.5, textAlign: 'center', color: 'var(--color-text-muted)', visibility: i % 2 === 0 ? 'visible' : 'hidden' }}>
              {c}
            </span>
          ))}
          {rows.map((row, r) => (
            <div key={row.day} style={{ display: 'contents' }}>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)', alignSelf: 'center' }}>{row.day}</span>
              {row.values.map((v, c) => (
                <span
                  key={c}
                  onMouseEnter={() => setHover({ r, c })}
                  style={{
                    height: 22,
                    background: cell(v),
                    outline: hover?.r === r && hover?.c === c ? '1px solid var(--color-ice-bright)' : 'none',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        {hover && (
          <div className={styles.tooltip} style={{ left: `calc(38px + (100% - 38px) * ${(hover.c + 0.5) / columns.length})`, top: 18 + hover.r * 24 }}>
            <div className={styles.tooltipTitle}>
              {rows[hover.r].day} · {columns[hover.c]}
            </div>
            <div className={styles.tooltipRow}>
              Activité <strong>{Math.round(rows[hover.r].values[hover.c] * 100)} %</strong>
            </div>
          </div>
        )}
        <div className={styles.heatScale}>
          Faible <span aria-hidden="true" /> Forte
        </div>
      </div>
    </ChartFrame>
  )
}
