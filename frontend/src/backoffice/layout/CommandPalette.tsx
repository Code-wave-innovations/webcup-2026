import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { flatNav } from '../nav'
import type { Persona } from '../mocks/types'
import { STATUS_LABEL } from '../lib/labels'
import { useRequestStore } from '../stores/requestStore'
import { Icon, type IconName } from '../ui/Icon'
import { Kbd } from '../ui/Feedback'
import styles from './CommandPalette.module.css'

interface Command {
  id: string
  label: string
  hint: string
  icon: IconName
  group: string
  to: string
}

/** ⌘K / Ctrl+K: jump to any screen or request by typing. */
export function CommandPalette({ persona, open, onClose }: { persona: Persona; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const requests = useRequestStore((s) => s.requests)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const base = persona === 'ADMIN' ? '/admin' : '/agent'
    const screens = flatNav(persona).map((item) => ({
      id: item.path,
      label: item.label,
      hint: item.codes.join(' · '),
      icon: item.icon,
      group: 'Écrans',
      to: item.path,
    }))
    const requestItems = requests.map((r) => ({
      id: `req-${r.id}`,
      label: `${r.reference} — ${r.subject}`,
      hint: STATUS_LABEL[r.status],
      icon: 'inbox' as const,
      group: 'Demandes',
      to: `${base}/demandes/${r.id}`,
    }))
    const other = {
      id: 'switch',
      label: persona === 'ADMIN' ? 'Passer à l’espace agent' : 'Passer à l’administration',
      hint: 'Persona de démonstration',
      icon: 'swap' as const,
      group: 'Actions',
      to: persona === 'ADMIN' ? '/agent' : '/admin',
    }
    return [...screens, ...requestItems, other]
  }, [persona, requests])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q)) : commands.filter((c) => c.group !== 'Demandes').concat(commands.filter((c) => c.group === 'Demandes').slice(0, 4))
    return list.slice(0, 12)
  }, [commands, query])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const go = (command: Command | undefined) => {
    if (!command) return
    onClose()
    setQuery('')
    navigate(command.to)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.layer}>
          <motion.div className={styles.backdrop} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Palette de commandes"
            className={styles.palette}
            initial={{ opacity: 0, y: -16, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') go(results[active])
            }}
          >
            <div className={styles.inputRow}>
              <Icon name="search" size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                placeholder="Écran, référence NT-…, sujet…"
                aria-label="Rechercher une commande"
                role="combobox"
                aria-expanded="true"
                aria-controls="bo-palette-list"
                aria-activedescendant={results[active] ? `bo-cmd-${results[active].id}` : undefined}
              />
              <Kbd>Échap</Kbd>
            </div>
            <ul id="bo-palette-list" role="listbox" className={styles.list}>
              {results.length === 0 && <li className={styles.empty}>Aucun résultat pour « {query} »</li>}
              {results.map((command, i) => (
                <li
                  key={command.id}
                  id={`bo-cmd-${command.id}`}
                  role="option"
                  aria-selected={i === active}
                  className={styles.item}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(command)}
                >
                  {i === active && <motion.span layoutId="palette-active" className={styles.activeBg} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <Icon name={command.icon} size={17} />
                  <span className={styles.label}>{command.label}</span>
                  <span className={styles.hint}>{command.hint}</span>
                </li>
              ))}
            </ul>
            <footer className={styles.foot}>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> naviguer
              </span>
              <span>
                <Kbd>↵</Kbd> ouvrir
              </span>
              <span>
                <Kbd>/</Kbd> recherche de la page
              </span>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
