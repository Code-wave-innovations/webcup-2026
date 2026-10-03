import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { onSessionExpired } from '../../api/session'
import { LAST_POSE } from '../../experience/city/cameraPath'
import { director } from '../../experience/director/director'
import { useDirectorStore } from '../../experience/director/directorStore'
import { announce } from '../../ui/toastStore'
import { ConsoleTopBar } from './ConsoleTopBar'
import styles from './ConsoleLayout.module.css'

/**
 * The city's pages beyond the flyover (/ville/*): a reading surface laid over the city, which stays
 * behind, dimmed and frozen on its overview. Usable at once, even while the 3D is still loading.
 */
export function ConsoleLayout() {
  const status = useDirectorStore((s) => s.status)
  const { pathname } = useLocation()

  useEffect(() => {
    useDirectorStore.getState().setConsole(true)
    return () => useDirectorStore.getState().setConsole(false)
  }, [])

  // deep link or reload: the film lands in the city instead of waiting in the cockpit
  useEffect(() => {
    const store = useDirectorStore.getState()
    if (status === 'ready') {
      if (director.phase === 'approach') director.land(LAST_POSE)
      else director.setScroll(LAST_POSE)
    } else if (status === 'unsupported' && store.phase !== 'city') {
      store.setPhase('city')
    }
  }, [status])

  // each page starts at the top (ConsolePage then focuses its title)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => onSessionExpired(() => announce('Votre session a expiré. Reconnectez-vous pour retrouver votre espace.')), [])

  return (
    <div className={styles.console}>
      <a className={styles.skip} href="#contenu">
        Aller au contenu
      </a>
      <div className={styles.veil} aria-hidden="true" />
      <ConsoleTopBar />
      <main id="contenu" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>NOVA, plateforme numérique de Terra Nova.</span>
        <span>24H by Webcup 2026</span>
      </footer>
    </div>
  )
}
