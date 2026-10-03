import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { stagger } from '../ui/motion'
import { Panel } from '../ui/Panel'
import { HudBackground } from './HudBackground'
import styles from './Access.module.css'

/** HUD backdrop and a single centred panel, for the screens outside the shell (login, refusals). */
export function AccessFrame({ space, title, lead, children }: { space: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className={[styles.frame, 'bo-root'].join(' ')}>
      <HudBackground />
      <motion.main className={styles.card} variants={stagger} initial="hidden" animate="show">
        <p className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span>
            NOVA · CONSOLE<small>{space}</small>
          </span>
        </p>
        <Panel accent="ice">
          <h1 className={styles.title} data-page-title tabIndex={-1}>
            {title}
          </h1>
          {lead && <p className={styles.lead}>{lead}</p>}
          {children}
        </Panel>
      </motion.main>
    </div>
  )
}
