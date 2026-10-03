import type { ReactNode } from 'react'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  /** id of the control, for the label */
  htmlFor?: string
  /** a group of controls (chips) is labelled by a legend instead */
  group?: boolean
  error?: string | null
  errorId?: string
  children: ReactNode
}

/** Label, control and error message, styled for the interface glass. */
export function Field({ label, htmlFor, group, error, errorId, children }: FieldProps) {
  const message = error ? (
    <span className={styles.error} id={errorId} role="alert">
      {error}
    </span>
  ) : null
  if (group) {
    return (
      <fieldset className={styles.field}>
        <legend className={styles.label}>{label}</legend>
        {children}
        {message}
      </fieldset>
    )
  }
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {message}
    </div>
  )
}
