import { useId, type ReactNode } from 'react'
import { defineMessages, useMessages } from '../i18n'
import styles from './Field.module.css'

const messages = defineMessages({ required: ' (obligatoire)' }, { required: ' (required)' })

/** Attributes the field hands to its control so label, hint and error are announced with it (F42). */
export interface ControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: boolean
}

interface FieldProps {
  label: string
  /** id of the control, for the label (generated when absent) */
  htmlFor?: string
  /** a group of controls (chips) is labelled by a legend instead */
  group?: boolean
  /** short help under the label, read with the control */
  hint?: ReactNode
  /** shows "obligatoire" next to the label and sets `required` on the control */
  required?: boolean
  error?: string | null
  errorId?: string
  /**
   * The control. As a function it receives `ControlProps` (id, aria-describedby, aria-invalid, required):
   * that is the form to use with `ErrorSummary`, which announces the errors.
   */
  children: ReactNode | ((control: ControlProps) => ReactNode)
}

/** Label, control, help and error message, styled for the interface glass. */
export function Field({ label, htmlFor, group, hint, required, error, errorId, children }: FieldProps) {
  const autoId = useId()
  const m = useMessages(messages)
  const controlId = htmlFor ?? `${autoId}-control`
  const hintId = hint ? `${controlId}-hint` : undefined
  const messageId = error ? (errorId ?? `${controlId}-error`) : undefined
  const describedBy = [hintId, messageId].filter(Boolean).join(' ') || undefined
  const renderProp = typeof children === 'function'

  const control = renderProp
    ? children({ id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })
    : children
  const caption = (
    <>
      {label}
      {required && <span className={styles.required}>{m.required}</span>}
    </>
  )
  const help = hint ? (
    <span className={styles.hint} id={hintId}>
      {hint}
    </span>
  ) : null
  // With a render prop the ErrorSummary announces the errors; the older form announces each one itself.
  const message = error ? (
    <span className={styles.error} id={messageId} role={renderProp ? undefined : 'alert'}>
      {error}
    </span>
  ) : null

  if (group) {
    return (
      <fieldset className={styles.field} aria-describedby={describedBy}>
        <legend className={styles.label}>{caption}</legend>
        {help}
        {control}
        {message}
      </fieldset>
    )
  }
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={controlId}>
        {caption}
      </label>
      {help}
      {control}
      {message}
    </div>
  )
}
