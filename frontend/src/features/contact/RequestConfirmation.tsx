import { useEffect, useRef, useState } from 'react'
import { defineMessages, useMessages } from '../../i18n'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import styles from './Contact.module.css'

const messages = defineMessages(
  {
    title: 'Demande envoyée',
    reference: 'Référence',
    copied: 'Copiée',
    copy: 'Copier',
    next: 'Un agent va la prendre en charge. Vous serez prévenu·e dès qu’il y aura une suite.',
    follow: 'Suivre ma demande',
    backToCity: 'Retour à la ville',
    again: 'Envoyer un autre message',
  },
  {
    title: 'Request sent',
    reference: 'Reference',
    copied: 'Copied',
    copy: 'Copy',
    next: 'An agent will take it on. You will be told as soon as there is any news.',
    follow: 'Follow my request',
    backToCity: 'Back to the city',
    again: 'Send another message',
  },
)

interface RequestConfirmationProps {
  reference: string
  message: string
  /** when signed in, offer to open the request list */
  followTo?: string
  onAgain: () => void
}

/** D16: replaces the form after a successful send — reference first, not a toast. */
export function RequestConfirmation({ reference, message, followTo, onAgain }: RequestConfirmationProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [copied, setCopied] = useState(false)
  const m = useMessages(messages)

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
        {m.title}
      </h2>
      <p className={styles.confirmMessage}>{message}</p>
      <div className={styles.reference}>
        <span className={styles.referenceLabel}>{m.reference}</span>
        <code className={styles.referenceCode}>{reference}</code>
        <Button type="button" variant="ghost" small onClick={() => void copy()}>
          {copied ? m.copied : m.copy}
        </Button>
      </div>
      <p className={styles.confirmNext}>{m.next}</p>
      <div className={styles.confirmActions}>
        {followTo ? (
          <ButtonRouteLink to={followTo}>{m.follow}</ButtonRouteLink>
        ) : (
          <ButtonRouteLink to="/ville">{m.backToCity}</ButtonRouteLink>
        )}
        <Button type="button" variant="ghost" onClick={onAgain}>
          {m.again}
        </Button>
      </div>
    </div>
  )
}
