import type { ReactNode } from 'react'
import styles from './Badges.module.css'

export type Tone = 'neutral' | 'ok' | 'progress' | 'taken' | 'alert'

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={[styles.pill, tone !== 'neutral' && styles[tone]].filter(Boolean).join(' ')}>{children}</span>
}

export function Plate({ children }: { children: ReactNode }) {
  return <span className={styles.plate}>{children}</span>
}
