import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import { rise } from './motion'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  /** Request codes covered by the screen (D17, F22…), shown as a HUD caption. */
  codes?: string[]
  lead?: ReactNode
  actions?: ReactNode
  /** The screen still reads the simulated stores (not bound to the API yet): said next to the codes. */
  simulated?: boolean
}

export function PageHeader({ title, codes, lead, actions, simulated }: PageHeaderProps) {
  return (
    <motion.header variants={rise} className={styles.header}>
      <div className={styles.text}>
        {((codes && codes.length > 0) || simulated) && (
          <p className={styles.codes}>
            {codes && codes.length > 0 && (
              <span>
                <span aria-hidden="true">◆</span> {codes.join(' · ')}
              </span>
            )}
            {simulated && (
              <span className={styles.simulated}>
                <Icon name="info" size={13} />
                Données simulées<span className="bo-sr-only"> : cet écran n’est pas encore relié à l’API</span>
              </span>
            )}
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
