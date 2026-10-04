import { Suspense, useEffect, useState } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { Skeleton } from '../ui/Feedback'
import { pageTransition } from '../ui/motion'
import { BootSequence } from './BootSequence'
import { CommandPalette } from './CommandPalette'
import { HudBackground } from './HudBackground'
import { useActor, usePersona } from './persona'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import styles from './Shell.module.css'

const COLLAPSE_KEY = 'bo-sidebar-collapsed'

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** Back-office frame: HUD background, role navigation, top bar, animated page outlet. */
export function Shell() {
  const persona = usePersona()
  const actor = useActor()
  const location = useLocation()
  const outlet = useOutlet()
  const tablet = useMediaQuery('(max-width: 1100px)')
  const [collapsedPref, setCollapsedPref] = useState(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const collapsed = tablet || collapsedPref

  const toggleCollapsed = () => {
    const next = !collapsedPref
    setCollapsedPref(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* preference not kept in private mode */
    }
  }

  // ⌘K / Ctrl+K opens the palette; "/" jumps to the page's search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')
      if (e.key === '/' && !typing) {
        const search = document.querySelector<HTMLInputElement>('[data-search-input]')
        if (search) {
          e.preventDefault()
          search.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Screen readers: move focus to the new page title after navigation.
  useEffect(() => {
    const timer = setTimeout(() => document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true }), 520)
    window.scrollTo({ top: 0 })
    return () => clearTimeout(timer)
  }, [location.pathname])

  return (
    <div className={[styles.shell, 'bo-root', collapsed && styles.shellCollapsed].filter(Boolean).join(' ')}>
      <a className={styles.skip} href="#bo-main">
        Aller au contenu
      </a>
      <HudBackground />
      <BootSequence key={persona} persona={persona} user={actor} />

      <Sidebar
        persona={persona}
        collapsed={collapsed && !menuOpen}
        onToggleCollapsed={toggleCollapsed}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />
      <AnimatePresence>
        {menuOpen && (
          <motion.div className={styles.scrim} onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        )}
      </AnimatePresence>

      <div className={styles.main}>
        <Topbar persona={persona} onOpenMenu={() => setMenuOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        <main id="bo-main" className={styles.content}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} variants={pageTransition} initial="initial" animate="enter" exit="exit">
              {/* F95: the screens are loaded on demand (BackofficeApp) */}
              <Suspense fallback={<Skeleton lines={6} />}>{outlet}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette persona={persona} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
