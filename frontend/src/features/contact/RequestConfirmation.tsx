import { useEffect, useRef, useState } from 'react'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import styles from './Contact.module.css'

interface RequestConfirmationProps {
  reference: string
  message: string
  /** when signed in, offer to open the request list */
  followTo?: string
  /** flyover card: no leave-the-section link */
  embedded?: boolean
  onAgain: () => void
}

/** D16: replaces the form after a successful send — reference first, not a toast. */
export function RequestConfirmation({ reference, message, followTo, embedded = false, onAgain }: RequestConfirmationProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.confirmation} role="status">
      <div className={styles.confirmIcon} aria-hidden="true">
        <Icon name="check" size={28} />
      </div>
      <h2 ref={titleRef} className={styles.confirmTitle} tabIndex={-1}>
        Demande envoyée
      </h2>
      <p className={styles.confirmMessage}>{message}</p>
      <div className={styles.reference}>
        <span className={styles.referenceLabel}>Référence</span>
        <code className={styles.referenceCode}>{reference}</code>
        <Button type="button" variant="ghost" small onClick={() => void copy()}>
          {copied ? 'Copiée' : 'Copier'}
        </Button>
      </div>
      <p className={styles.confirmNext}>Un agent va la prendre en charge. Vous serez prévenu·e dès qu’il y aura une suite.</p>
      <div className={styles.confirmActions}>
        {!embedded &&
          (followTo ? (
            <ButtonRouteLink to={followTo}>Suivre ma demande</ButtonRouteLink>
          ) : (
            <ButtonRouteLink to="/ville">Retour à la ville</ButtonRouteLink>
          ))}
        <Button type="button" variant={embedded ? 'solid' : 'ghost'} onClick={onAgain}>
          Envoyer un autre message
        </Button>
      </div>
    </div>
  )
}
