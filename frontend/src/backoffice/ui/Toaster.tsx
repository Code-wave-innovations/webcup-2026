import { AnimatePresence, motion } from 'motion/react'
import { useToastStore } from '../stores/toastStore'
import { Icon } from './Icon'
import styles from './Toaster.module.css'

const ICON = { ok: 'check', info: 'info', alert: 'alert' } as const

/** Stacked confirmations, top right; announced politely to screen readers. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={[styles.toast, styles[t.tone]].join(' ')}
            initial={{ opacity: 0, x: 40, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <Icon name={ICON[t.tone]} size={16} />
            <span>{t.message}</span>
            <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Fermer la notification">
              <Icon name="close" size={14} />
            </button>
            <span className={styles.timer} aria-hidden="true" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
