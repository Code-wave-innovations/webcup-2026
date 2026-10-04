import { useEffect, useRef, type MouseEvent } from 'react'
import { Outlet } from 'react-router'
import { Experience } from '../experience/Experience'
import { SoundDirector } from '../experience/audio/SoundDirector'
import { SoundToggle } from '../experience/audio/SoundToggle'
import { LAST_POSE } from '../experience/city/cameraPath'
import { debugJump } from '../experience/director/debugParams'
import { director } from '../experience/director/director'
import { NovaHitZone } from '../experience/nova/NovaHitZone'
import { NovaSpeechBubble } from '../experience/nova/NovaSpeechBubble'
import { useDirectorStore } from '../experience/director/directorStore'
import { AlertCenter } from '../features/announcements/AlertCenter'
import { ReminderWatcher } from '../features/appointments/ReminderWatcher'
import { NetworkIncident } from '../features/network/NetworkIncident'
import { useCitizenUser } from '../api/session'
import { toSession } from '../features/auth/authService'
import { useAuthStore } from '../features/auth/authStore'
import { DEMO_ACCOUNTS } from '../features/auth/demoAccounts'
import { defineMessages, useMessages } from '../i18n'
import { Toast } from '../ui/Toast'
import { FilmLoadingScreen } from './FilmLoadingScreen'
import styles from './FilmLayout.module.css'

const messages = defineMessages(
  { skipToContent: 'Aller au contenu', skipArrival: "Passer l'arrivée" },
  { skipToContent: 'Skip to content', skipArrival: 'Skip the arrival' },
)

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
  // console pages are usable at once: the city fades in behind them when it is ready
  const consoleOpen = useDirectorStore((s) => s.console)
  const filmSession = useAuthStore((s) => s.session)
  const citizen = useCitizenUser()
  const debugSignIn = useRef(false)
  const m = useMessages(messages)

  // the letterbox bars retract once the city is reached (or after a return to the cockpit)
  useEffect(() => {
    if (phase === 'city' || phase === 'explore' || phase === 'approach') useDirectorStore.getState().setCinematic(false)
  }, [phase])

  // console pages (/ville/*), even on a deep link or a reload: the film lands on the city's overview
  useEffect(() => {
    if (!consoleOpen) return
    const store = useDirectorStore.getState()
    if (status === 'ready') {
      if (director.phase === 'approach') director.land(LAST_POSE)
      else director.setScroll(LAST_POSE)
    } else if (status === 'unsupported' && store.phase !== 'city') {
      store.setPhase('city')
    }
  }, [consoleOpen, status])

  // `?vue` / `?arrivee` land in the city without a login: demo film chrome only (no API JWT).
  // Skip when a real citizen session already fills the city gate.
  useEffect(() => {
    if (!debugJump || debugSignIn.current || filmSession || citizen || phase === 'approach' || phase === 'entry') return
    debugSignIn.current = true
    useAuthStore.getState().signIn(toSession(DEMO_ACCOUNTS.miora))
  }, [phase, filmSession, citizen])

  return (
    <>
      <a className={styles.skipLink} href="#contenu" onClick={skipToContent}>
        {m.skipToContent}
      </a>
      <Experience />
      <div className={styles.letterbox} data-active={cinematic} aria-hidden="true">
        <i />
        <i />
      </div>
      <FilmLoadingScreen done={status !== 'loading' || consoleOpen} />
      <Outlet />
      {/* D18: the High Council reaches every screen of the film, the airlock included */}
      <AlertCenter />
      {/* F40: the appointment reminders reach the resident on every screen of the film */}
      <ReminderWatcher />
      <NetworkIncident />
      <NovaHitZone />
      <NovaSpeechBubble />
      {cinematic && (phase === 'entry' || phase === 'descent') && (
        <button type="button" className={styles.skip} onClick={() => director.skip()}>
          {m.skipArrival}
        </button>
      )}
      <Toast />
      <SoundToggle />
      <SoundDirector />
    </>
  )
}
