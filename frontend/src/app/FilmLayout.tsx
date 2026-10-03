import { useEffect, useRef, type MouseEvent } from 'react'
import { Outlet } from 'react-router'
import { Experience } from '../experience/Experience'
import { SoundDirector } from '../experience/audio/SoundDirector'
import { SoundToggle } from '../experience/audio/SoundToggle'
import { debugJump } from '../experience/director/debugParams'
import { director } from '../experience/director/director'
import { NovaHitZone } from '../experience/nova/NovaHitZone'
import { NovaSpeechBubble } from '../experience/nova/NovaSpeechBubble'
import { useDirectorStore } from '../experience/director/directorStore'
import { toSession } from '../features/auth/authService'
import { useAuthStore } from '../features/auth/authStore'
import { DEMO_ACCOUNTS } from '../features/auth/demoAccounts'
import { Toast } from '../ui/Toast'
import styles from './FilmLayout.module.css'

/** Keyboard users jump over the navigation to the page itself (the city sections, the chat, the airlock form). */
function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.querySelector<HTMLElement>('main, form, h1')
  if (!target) return
  event.preventDefault()
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

/** Shell of the film routes: the persistent 3D behind, the cinema chrome around, the page in front. */
export function FilmLayout() {
  const status = useDirectorStore((s) => s.status)
  const phase = useDirectorStore((s) => s.phase)
  const cinematic = useDirectorStore((s) => s.cinematic)
  const session = useAuthStore((s) => s.session)
  const debugSignIn = useRef(false)

  // the letterbox bars retract once the city is reached (or after a return to the cockpit)
  useEffect(() => {
    if (phase === 'city' || phase === 'explore' || phase === 'approach') useDirectorStore.getState().setCinematic(false)
  }, [phase])

  // `?vue` / `?arrivee` land in the city without a login: use the resident demo account, as the prototype did
  useEffect(() => {
    if (!debugJump || debugSignIn.current || session || phase === 'approach' || phase === 'entry') return
    debugSignIn.current = true
    useAuthStore.getState().signIn(toSession(DEMO_ACCOUNTS.miora))
  }, [phase, session])

  return (
    <>
      <a className={styles.skipLink} href="#contenu" onClick={skipToContent}>
        Aller au contenu
      </a>
      <Experience />
      <div className={styles.letterbox} data-active={cinematic} aria-hidden="true">
        <i />
        <i />
      </div>
      <div className={styles.loading} data-done={status !== 'loading'} role="status">
        <b>Liaison avec le contrôle d'approche</b>
        <i />
      </div>
      <Outlet />
      <NovaHitZone />
      <NovaSpeechBubble />
      {cinematic && (phase === 'entry' || phase === 'descent') && (
        <button type="button" className={styles.skip} onClick={() => director.skip()}>
          Passer l'arrivée
        </button>
      )}
      <Toast />
      <SoundToggle />
      <SoundDirector />
    </>
  )
}
