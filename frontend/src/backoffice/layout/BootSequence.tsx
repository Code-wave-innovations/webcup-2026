import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTypewriter } from '../../ui/useTypewriter'
import type { User } from '../../api/types'
import type { Persona } from '../mocks/types'
import { ROLE_LABEL } from '../lib/labels'
import { markBooted, shouldBoot } from './boot'
import styles from './BootSequence.module.css'

/** First visit of the session: grid traces, hex logo assembles, uplink line types out. ≤ 1.3 s, skippable. */
export function BootSequence({ persona, user }: { persona: Persona; user: Pick<User, 'name' | 'last_name' | 'role'> }) {
  const [visible, setVisible] = useState(() => shouldBoot(persona))
  const line = `Liaison établie · ${user.name} ${user.last_name}, ${ROLE_LABEL[user.role]}`
  const typed = useTypewriter(visible ? line : '')

  useEffect(() => {
    if (!visible) return
    markBooted(persona)
    const done = () => setVisible(false)
    const timer = setTimeout(done, 1500)
    window.addEventListener('keydown', done, { once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', done)
    }
  }, [visible, persona])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.boot}
          onClick={() => setVisible(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)', transition: { duration: 0.45 } }}
          role="presentation"
        >
          <svg className={styles.logo} viewBox="0 0 120 120" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a1 = (Math.PI / 3) * i - Math.PI / 2
              const a2 = (Math.PI / 3) * (i + 1) - Math.PI / 2
              return (
                <motion.line
                  key={i}
                  x1={60 + 46 * Math.cos(a1)}
                  y1={60 + 46 * Math.sin(a1)}
                  x2={60 + 46 * Math.cos(a2)}
                  y2={60 + 46 * Math.sin(a2)}
                  stroke="var(--color-ice)"
                  strokeWidth={2}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                />
              )
            })}
            <motion.path
              d="M60 34 L82 47 L82 73 L60 86 L38 73 L38 47 Z"
              fill="var(--color-ice)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.9 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 18 }}
              style={{ originX: '60px', originY: '60px' }}
            />
          </svg>
          <p className={styles.brand}>NOVA · CONSOLE</p>
          <p className={styles.line} aria-live="polite">
            {typed}
            <span className={styles.caret} aria-hidden="true" />
          </p>
          <span className={styles.bar} aria-hidden="true" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
