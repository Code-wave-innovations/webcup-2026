import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { rise } from './motion'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  lead?: ReactNode
  actions?: ReactNode
  /** The screen still reads the simulated stores (not bound to the API yet). */
  simulated?: boolean
}

export function PageHeader({ title, lead, actions, simulated }: PageHeaderProps) {
  return (
    <motion.header variants={rise} className={styles.header}>
      <div className={styles.text}>
        {simulated && (
          <p className={styles.codes}>
            <span className={styles.simulated}>
              <Icon name="info" size={13} />
              Données simulées · navigateur seulement
              <span className="bo-sr-only">
                {' '}
                : les actions restent locales ; elles ne modifient pas l’API. Hors rôle, le serveur refuse toujours.
              </span>
            </span>
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
