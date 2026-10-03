import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { rise } from './motion'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  /** Request codes covered by the screen (D17, F22…), shown as a HUD caption. */
  codes?: string[]
  lead?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, codes, lead, actions }: PageHeaderProps) {
  return (
    <motion.header variants={rise} className={styles.header}>
      <div className={styles.text}>
        {codes && codes.length > 0 && (
          <p className={styles.codes}>
            <span aria-hidden="true">◆</span> {codes.join(' · ')}
          </p>
        )}
        <h1 className={styles.title} data-page-title tabIndex={-1}>
          {title}
        </h1>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </motion.header>
  )
}
