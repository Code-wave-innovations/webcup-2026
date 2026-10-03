import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Tone } from '../lib/labels'
import { Icon } from './Icon'
import styles from './Timeline.module.css'

export interface TimelineItem {
  id: number | string
  title: ReactNode
  meta?: ReactNode
  body?: ReactNode
  tone?: Tone
  /** true: agent-only entry (internal note, assignment). false: said « Visible par l'habitant » (D11). */
  internal?: boolean
  /** F49: the citizen received a notification for this step */
  notified?: boolean
  current?: boolean
}

/** Vertical timeline with diamond stations (the client's report tracker, denser). */
export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol className={styles.timeline} aria-label={label}>
      {items.map((item, index) => (
        <motion.li
          key={item.id}
          className={[styles.item, item.tone && styles[item.tone], item.current && styles.current, item.internal && styles.internal]
            .filter(Boolean)
            .join(' ')}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(index, 10) * 0.04, duration: 0.3 }}
        >
          <span className={styles.station} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.title}>
              {item.title}
              {item.internal && <span className={styles.badge}>Interne</span>}
              {item.internal === false && <span className={[styles.badge, styles.public].join(' ')}>Visible par l’habitant</span>}
              {item.notified && (
                <span className={[styles.badge, styles.public].join(' ')}>
                  <Icon name="bell" size={11} /> Habitant prévenu
                </span>
              )}
            </p>
            {item.meta && <p className={styles.meta}>{item.meta}</p>}
            {item.body && <div className={styles.body}>{item.body}</div>}
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
