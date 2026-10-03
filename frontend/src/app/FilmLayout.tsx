import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router'
import { Experience } from '../experience/Experience'
import { debugParams } from '../experience/director/debugParams'
import { director } from '../experience/director/director'
import { useDirectorStore } from '../experience/director/directorStore'
import { toSession } from '../features/auth/authService'
import { useAuthStore } from '../features/auth/authStore'
import { DEMO_ACCOUNTS } from '../features/auth/demoAccounts'
import { Toast } from '../ui/Toast'
import styles from './FilmLayout.module.css'

const debugJump = debugParams.view !== undefined || debugParams.arrival !== undefined

/** Shell of the film routes: the persistent 3D behind, the cinema chrome around, the page in front. */
export function FilmLayout() {
  const status = useDirectorStore((s) => s.status)
  const phase = useDirectorStore((s) => s.phase)
  const cinematic = useDirectorStore((s) => s.cinematic)
  const session = useAuthStore((s) => s.session)
  const debugSignIn = useRef(false)

  // the letterbox bars retract once the city is reached (or after a return to the cockpit)
  useEffect(() => {
    if (phase === 'city' || phase === 'approach') useDirectorStore.getState().setCinematic(false)
  }, [phase])

  // `?vue` / `?arrivee` land in the city without a login: use the resident demo account, as the prototype did
  useEffect(() => {
    if (!debugJump || debugSignIn.current || session || phase === 'approach' || phase === 'entry') return
    debugSignIn.current = true
    useAuthStore.getState().signIn(toSession(DEMO_ACCOUNTS.miora))
  }, [phase, session])

  return (
    <>
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
      {cinematic && (phase === 'entry' || phase === 'descent') && (
        <button type="button" className={styles.skip} onClick={() => director.skip()}>
          Passer l'arrivée
        </button>
      )}
      <Toast />
    </>
  )
}
