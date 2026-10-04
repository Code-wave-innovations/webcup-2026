import { useEffect, useRef, useState } from 'react'
import { Plate } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import text from '../../ui/text.module.css'
import styles from './ReportPanel.module.css'
import { useReportStore } from './reportStore'

/** D16: replaces the form as soon as the server has recorded the request. */
export function RequestConfirmation() {
  const confirmation = useReportStore((s) => s.confirmation)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  if (!confirmation) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(confirmation.reference)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.confirmation} role="status">
      <h3 ref={titleRef} className={styles.confirmationTitle} tabIndex={-1}>
        Demande envoyée
      </h3>
      <p>{confirmation.message}</p>
      <div className={styles.line}>
        <Plate>{confirmation.reference}</Plate>
        <Button variant="ghost" small onClick={() => void copy()}>
          {copied ? 'Référence copiée' : 'Copier la référence'}
        </Button>
      </div>
      <p className={text.note}>Un agent va la prendre en charge. Vous serez prévenu·e.</p>
      <div className={styles.actions}>
        <Button onClick={() => useReportStore.getState().follow()}>Suivre ma demande</Button>
        <Button variant="ghost" onClick={() => useReportStore.getState().reset()}>
          Envoyer une autre demande
        </Button>
      </div>
    </div>
  )
}
