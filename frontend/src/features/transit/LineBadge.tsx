import type { CSSProperties } from 'react'
import type { TransitLineSummary } from '../../api/types'
import styles from './Transit.module.css'

/** Code plate tinted with the line's colour, always followed by its name (the colour is never the only cue). */
export function LineBadge({ line, withName = true }: { line: Pick<TransitLineSummary, 'code' | 'name' | 'color'>; withName?: boolean }) {
  return (
    <span className={styles.lineBadge}>
      <span className={styles.lineCode} style={line.color ? ({ '--line-color': line.color } as CSSProperties) : undefined}>
        {line.code}
      </span>
      {withName && <span className={styles.lineName}>{line.name}</span>}
    </span>
  )
}
