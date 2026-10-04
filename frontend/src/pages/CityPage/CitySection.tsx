import type { ReactNode } from 'react'
import { GlassPanel } from '../../ui/GlassPanel'
import { NovaMark } from '../../ui/Icon'
import { useCitySectionLabels, type CitySectionInfo } from './citySections'
import styles from './CityPage.module.css'

interface CitySectionProps {
  info: CitySectionInfo
  /** side of the text column; the district is framed on the other side */
  side: 'left' | 'right'
  title: ReactNode
  lead: string
  /** denser column under the top bar (forms that must fit the sticky frame) */
  compact?: boolean
  children: ReactNode
}

/** One district of the flyover: place, title, lead, and the feature on a glass panel. */
export function CitySection({ info, side, title, lead, compact, children }: CitySectionProps) {
  const titleId = `${info.id}-title`
  const labels = useCitySectionLabels()
  return (
    <section
      className={[styles.section, compact && styles.compact].filter(Boolean).join(' ')}
      id={info.id}
      data-city-section
      aria-labelledby={titleId}
    >
      <div className={[styles.frame, side === 'right' && styles.right].filter(Boolean).join(' ')}>
        <div className={styles.column} data-column>
          <div className={styles.block}>
            <p className={styles.place}>
              <NovaMark filled size={14} />
              {labels[info.id].rail}
            </p>
            <h2 className={styles.heading} id={titleId}>
              {title}
            </h2>
            <p className={styles.lead}>{lead}</p>
          </div>
          <GlassPanel data-panel>{children}</GlassPanel>
        </div>
      </div>
    </section>
  )
}
