import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { initials } from '../lib/format'
import type { Tone } from '../lib/labels'
import { Icon, type IconName } from './Icon'
import styles from './Feedback.module.css'

export function EmptyState({ title, icon = 'radar', children }: { title: string; icon?: IconName; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <p className={styles.emptyText}>{children}</p>}
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  )
}

/** Meter: the fill carries the state, the track is a dimmer step of the same hue. */
export function ProgressBar({ value, max = 1, tone = 'ice', label }: { value: number; max?: number; tone?: Tone; label: string }) {
  const ratio = Math.max(0, Math.min(1, value / max))
  return (
    <span
      className={[styles.meter, styles[tone]].join(' ')}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <motion.span
        className={styles.fill}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: ratio }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>
}

/** Hexagonal initials badge. */
export function Avatar({ name, lastName, size = 34, tone = 'ice' }: { name: string; lastName?: string; size?: number; tone?: Tone }) {
  return (
    <span className={[styles.avatar, styles[tone]].join(' ')} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials(name, lastName)}
    </span>
  )
}

/** Blinking "live" signal for real-time feeds. */
export function LiveDot({ label = 'En direct' }: { label?: string }) {
  return (
    <span className={styles.live}>
      <span className={styles.liveDot} aria-hidden="true" />
      {label}
    </span>
  )
}

export function DemoNote({ children = 'Données simulées' }: { children?: ReactNode }) {
  return (
    <span className={styles.demo}>
      <Icon name="info" size={13} />
      {children}
    </span>
  )
}
