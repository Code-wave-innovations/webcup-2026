import type { ReactNode } from 'react'
import type { RequestPriority, RequestStatus } from '../mocks/types'
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_TONE, type Tone } from '../lib/labels'
import { Icon } from './Icon'
import styles from './Badges.module.css'

/** Outlined pill: colour carries the tone, the text always carries the meaning. */
export function Tag({ tone = 'neutral', children, pulse }: { tone?: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={[styles.tag, styles[tone], pulse && styles.pulse].filter(Boolean).join(' ')}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  )
}

export function StatusPill({ status }: { status: RequestStatus }) {
  return <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>
}

const PRIORITY_TONE: Record<RequestPriority, Tone> = { LOW: 'neutral', NORMAL: 'ice', HIGH: 'progress', URGENT: 'alert' }

/** Priority as a signal-strength meter plus its label. */
export function PriorityTag({ priority }: { priority: RequestPriority }) {
  const level = { LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 }[priority]
  return (
    <span className={[styles.priority, styles[PRIORITY_TONE[priority]], priority === 'URGENT' && styles.pulse].filter(Boolean).join(' ')}>
      <span className={styles.bars} aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} data-on={n <= level} />
        ))}
      </span>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

/** Reference code (registration plate look from the client). */
export function Ref({ children }: { children: ReactNode }) {
  return <span className={styles.ref}>{children}</span>
}

export function Counter({ value, tone = 'ember', label }: { value: number; tone?: Tone; label: string }) {
  if (value === 0) return null
  return (
    <span className={[styles.counter, styles[tone]].join(' ')} aria-label={label}>
      {value}
    </span>
  )
}

export function Flag({ icon, children, tone = 'ice' }: { icon: 'star' | 'lock' | 'alert' | 'zap' | 'eye'; children: ReactNode; tone?: Tone }) {
  return (
    <span className={[styles.flag, styles[tone]].join(' ')}>
      <Icon name={icon} size={14} />
      {children}
    </span>
  )
}
