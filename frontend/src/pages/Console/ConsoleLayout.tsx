import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { onSessionExpired } from '../../api/session'
import { isLightScene } from '../../a11y/sceneMode'
import { useDirectorStore } from '../../experience/director/directorStore'
import { announce } from '../../ui/toastStore'
import { ConsoleTopBar } from './ConsoleTopBar'
import styles from './ConsoleLayout.module.css'

/**
 * The city's pages beyond the flyover (/ville/*): a reading surface laid over the city, which stays
 * behind, dimmed and frozen on its overview (`FilmLayout` lands the film there when `console` is set).
 * It never imports the 3D, so the light version (F96) uses it as is.
 */
export function ConsoleLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    useDirectorStore.getState().setConsole(true)
    return () => useDirectorStore.getState().setConsole(false)
  }, [])

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
      {!isLightScene && <div className={styles.veil} aria-hidden="true" />}
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
