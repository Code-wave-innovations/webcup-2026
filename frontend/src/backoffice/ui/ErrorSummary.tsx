import type { MouseEvent } from 'react'
import type { SummaryError } from '../../hooks/useApiForm'
import { Icon } from './Icon'
import styles from './ErrorSummary.module.css'

/**
 * F42: after a failed submit, what to fix at the top of the form, a link to each field. It receives
 * the focus (useApiForm) so screen readers announce it.
 */
export function ErrorSummary({ errors, formError, id }: { errors: SummaryError[]; formError?: string | null; id: string }) {
  if (!errors.length && !formError) return null

  const goTo = (event: MouseEvent<HTMLAnchorElement>, fieldId: string) => {
    const control = document.getElementById(fieldId)
    if (!control) return
    event.preventDefault()
    control.focus()
  }

  return (
    <div className={styles.summary} id={id} tabIndex={-1} role="alert">
      <Icon name="alert" size={18} />
      <div>
        {errors.length > 0 && (
          <>
            <p className={styles.title}>{errors.length === 1 ? 'Une information est à corriger' : `${errors.length} informations sont à corriger`}</p>
            <ul>
              {errors.map((error) => (
                <li key={error.id}>
                  <a href={`#${error.id}`} onClick={(event) => goTo(event, error.id)}>
                    {error.label} : {error.message}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {formError && <p className={errors.length ? undefined : styles.title}>{formError}</p>}
      </div>
    </div>
  )
}
