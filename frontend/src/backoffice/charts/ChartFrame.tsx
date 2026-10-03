import { useState, type ReactNode } from 'react'
import styles from './Charts.module.css'

interface ChartFrameProps {
  /** Accessible summary of what the chart shows. */
  summary: string
  table: { columns: string[]; rows: (string | number)[][] }
  children: ReactNode
}

/** Every chart has a table view (accessibility, exact values), one click away. */
export function ChartFrame({ summary, table, children }: ChartFrameProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <div className={styles.root}>
      <div className={styles.frameBar}>
        <div className={styles.switch} role="group" aria-label="Affichage">
          <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            Graphique
          </button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Tableau
          </button>
        </div>
      </div>
      {view === 'chart' ? (
        <figure role="img" aria-label={summary} style={{ margin: 0 }}>
          {children}
        </figure>
      ) : (
        <table className={styles.table}>
          <caption className="bo-sr-only">{summary}</caption>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
