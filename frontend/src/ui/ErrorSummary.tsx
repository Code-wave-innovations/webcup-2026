import type { MouseEvent } from 'react'
import type { SummaryError } from '../hooks/useApiForm'
import styles from './ErrorSummary.module.css'

interface ErrorSummaryProps {
  errors: SummaryError[]
  /** an error that belongs to no field (wrong password, server unreachable…) */
  formError?: string | null
  /** useApiForm's summaryId: the summary takes the focus after a failed submit */
  id: string
}

/**
 * F42: after a failed submit, lists what to fix at the top of the form, with a link to each field.
 * It receives the focus (see `useApiForm`) so screen readers announce it right away.
 */
export function ErrorSummary({ errors, formError, id }: ErrorSummaryProps) {
  if (!errors.length && !formError) return null

  const goTo = (event: MouseEvent<HTMLAnchorElement>, fieldId: string) => {
    const control = document.getElementById(fieldId)
    if (!control) return
    event.preventDefault()
    control.focus()
    control.scrollIntoView({ block: 'center' })
  }

  return (
    <div className={styles.summary} id={id} tabIndex={-1} role="alert">
      {errors.length > 0 ? (
        <>
          <p className={styles.title}>
            {errors.length === 1 ? 'Une information est à corriger :' : `${errors.length} informations sont à corriger :`}
          </p>
          <ul>
            {errors.map((error) => (
              <li key={error.id}>
                <a href={`#${error.id}`} onClick={(event) => goTo(event, error.id)}>
                  {error.label} : {error.message}
                </a>
              </li>
            ))}
          </ul>
          {formError && <p>{formError}</p>}
        </>
      ) : (
        <p className={styles.title}>{formError}</p>
      )}
    </div>
  )
}
