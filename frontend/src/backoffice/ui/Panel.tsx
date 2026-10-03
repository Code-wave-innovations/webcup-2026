import type { ComponentProps, ReactNode } from 'react'
import { motion } from 'motion/react'
import { rise } from './motion'
import styles from './Panel.module.css'

interface PanelProps extends Omit<ComponentProps<typeof motion.section>, 'title'> {
  title?: ReactNode
  /** Small uppercase label above the title (HUD caption). */
  kicker?: ReactNode
  actions?: ReactNode
  /** Accent edge colour: highlights urgent or live panels. */
  accent?: 'ice' | 'ember' | 'alert' | 'ok'
  /** Remove inner padding (tables that run edge to edge). */
  flush?: boolean
  children?: ReactNode
}

/** Glass panel with cut corners (NOVA style), HUD brackets and a faint scanline. */
export function Panel({ title, kicker, actions, accent, flush, className, children, ...props }: PanelProps) {
  const headingId = props.id ? `${props.id}-title` : undefined
  return (
    <motion.section
      variants={rise}
      className={[styles.panel, accent && styles[accent], className].filter(Boolean).join(' ')}
      aria-labelledby={title ? headingId : undefined}
      {...props}
    >
      <span className={styles.brackets} aria-hidden="true" />
      {(title || actions || kicker) && (
        <header className={styles.header}>
          <div className={styles.titles}>
            {kicker && <p className={styles.kicker}>{kicker}</p>}
            {title && (
              <h2 className={styles.title} id={headingId}>
                {title}
              </h2>
            )}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={flush ? styles.flush : styles.body}>{children}</div>
    </motion.section>
  )
}
