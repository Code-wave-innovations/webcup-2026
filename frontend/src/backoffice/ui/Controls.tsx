import { useId, type ComponentProps, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Icon } from './Icon'
import styles from './Controls.module.css'

export function SearchInput({ label, className, ...props }: { label: string } & ComponentProps<'input'>) {
  return (
    <label className={[styles.search, className].filter(Boolean).join(' ')}>
      <Icon name="search" size={16} />
      <span className="bo-sr-only">{label}</span>
      <input type="search" placeholder={label} data-search-input {...props} />
    </label>
  )
}

interface Option<T extends string | number> {
  value: T
  label: string
  count?: number
}

/** Single-choice filter chips (aria-pressed), the client's chip style made denser. */
export function FilterChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className={styles.chipCount}>{option.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Tabs with a sliding glow underline (motion layoutId). */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  idPrefix,
}: {
  label: string
  tabs: Option<T>[]
  value: T
  onChange: (value: T) => void
  idPrefix: string
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const index = tabs.findIndex((t) => t.value === value)
              const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
              onChange(next.value)
              document.getElementById(`${idPrefix}-tab-${next.value}`)?.focus()
            }}
          >
            {tab.label}
            {tab.count !== undefined && <span className={styles.chipCount}>{tab.count}</span>}
            {selected && <motion.span layoutId={`${idPrefix}-underline`} className={styles.underline} />}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hideLabel,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hideLabel?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track} aria-hidden="true">
        <motion.span className={styles.thumb} layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
      </span>
      <span className={hideLabel ? 'bo-sr-only' : styles.toggleLabel}>{label}</span>
    </button>
  )
}

/** Labelled form control. Pass the input/select/textarea as child; the id is wired automatically. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: (id: string, describedBy?: string) => ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children(id, hintId)}
      {hint && (
        <small id={hintId} className={styles.hint}>
          {hint}
        </small>
      )}
    </div>
  )
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <span className={[styles.selectWrap, className].filter(Boolean).join(' ')}>
      <select className={styles.control} {...props}>
        {children}
      </select>
      <Icon name="chevronDown" size={16} />
    </span>
  )
}

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={[styles.control, className].filter(Boolean).join(' ')} {...props} />
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')} {...props} />
}
