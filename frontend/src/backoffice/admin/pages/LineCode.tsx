import type { CSSProperties } from 'react'
import type { TransitLineSummary } from '../../../api/types'
import styles from './admin.module.css'

/** F36: a line's code on a plate edged with its colour; the name is always written next to it. */
export function LineCode({ line }: { line: Pick<TransitLineSummary, 'code' | 'color'> }) {
  return (
    <span className={styles.lineCode} style={line.color ? ({ '--line-color': line.color } as CSSProperties) : undefined}>
      {line.code}
    </span>
  )
}
