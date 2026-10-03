import type { HTMLAttributes } from 'react'
import styles from './GlassPanel.module.css'

/** Content panel on display glass (the city sections). */
export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.glass, styles.panel, className].filter(Boolean).join(' ')} {...props} />
}
