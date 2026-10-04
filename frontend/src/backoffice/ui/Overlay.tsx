import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from './Button'
import { spring } from './motion'
import styles from './Overlay.module.css'

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Focus moves into the dialog, Tab stays inside, Escape closes, focus returns to the opener. */
function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  // the latest onClose, read when a key is pressed: a parent that re-renders (a ticking clock, a
  // refetch) hands a new function each time, which must not re-run the focus effect and steal the caret
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const dialog = ref.current
    const first = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open])
  return ref
}

interface OverlayProps {
  open: boolean
  onClose: () => void
  title: string
  kicker?: string
  children: ReactNode
  footer?: ReactNode
}

/** Side panel sliding in from the right, for details and edit forms. */
export function Drawer({ open, onClose, title, kicker, children, footer }: OverlayProps) {
  const ref = useDialogFocus(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.layer}>
          <motion.div className={styles.backdrop} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={styles.drawer}
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={spring}
          >
            <header className={styles.head}>
              <div>
                {kicker && <p className={styles.kicker}>{kicker}</p>}
                <h2 className={styles.title}>{title}</h2>
              </div>
              <Button iconOnly icon="close" variant="subtle" onClick={onClose}>
                Fermer
              </Button>
            </header>
            <div className={styles.content}>{children}</div>
            {footer && <footer className={styles.foot}>{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Centered dialog with a holographic unfold. */
export function Modal({ open, onClose, title, kicker, children, footer }: OverlayProps) {
  const ref = useDialogFocus(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={[styles.layer, styles.center].join(' ')}>
          <motion.div className={styles.backdrop} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={styles.modal}
            initial={{ opacity: 0, scaleY: 0.04, scaleX: 0.9 }}
            animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleY: 0.04 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <header className={styles.head}>
              <div>
                {kicker && <p className={styles.kicker}>{kicker}</p>}
                <h2 className={styles.title}>{title}</h2>
              </div>
              <Button iconOnly icon="close" variant="subtle" onClick={onClose}>
                Fermer
              </Button>
            </header>
            <div className={styles.content}>{children}</div>
            {footer && <footer className={styles.foot}>{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
