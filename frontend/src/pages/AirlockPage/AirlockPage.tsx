import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { director } from '../../experience/director/director'
import { useDirectorStore } from '../../experience/director/directorStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import { AccessHologram } from '../../features/auth/AccessHologram'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { useBodyClass } from '../../hooks/useBodyClass'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { useNovaLoginReactions } from './useNovaLoginReactions'
import styles from './AirlockPage.module.css'

type Step = 'login' | 'granted' | 'departing'

/** Access granted → entry: long enough for Nova's jump of joy and its line. */
const DEPARTURE_MS = 1900

/** Act I: Terra Nova seen from orbit, Nova and the access panel. The visitor identifies, then dives into the atmosphere. */
export function AirlockPage() {
  useBodyClass('is-locked')
  const status = useDirectorStore((s) => s.status)
  const phase = useDirectorStore((s) => s.phase)
  const session = useAuthStore((s) => s.session)
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const { search } = useLocation()
  const reduced = useReducedMotion()
  const [step, setStep] = useState<Step>('login')
  const departure = useRef<ReturnType<typeof setTimeout>>(undefined)
  const novaReacts = useNovaLoginReactions()

  // the film reached the surface: the city takes over
  useEffect(() => {
    if (session && (phase === 'descent' || phase === 'city')) navigate({ pathname: '/ville', search })
  }, [session, phase, navigate, search])

  useEffect(() => () => clearTimeout(departure.current), [])

  // the film comes to light: Nova greets the visitor; then braces for the entry
  useEffect(() => {
    if (status !== 'ready') return
    if (phase === 'approach') return novaScenes.greetPilot()
    if (phase === 'entry') return novaScenes.enterAtmosphere(reduced)
  }, [status, phase, reduced])

  const onGranted = (granted: Session) => {
    signIn(granted)
    setStep('granted')
    departure.current = setTimeout(
      () => {
        setStep('departing')
        const store = useDirectorStore.getState()
        if (store.status !== 'ready') {
          // no 3D: straight to the city interface
          store.setPhase('city')
          return
        }
        store.setCinematic(true)
        director.enter()
      },
      reduced ? 300 : DEPARTURE_MS,
    )
  }

  return (
    <section className={styles.airlock} aria-labelledby="airlock-title">
      <AccessHologram collapsed={step === 'departing'} onGranted={onGranted} onActivity={novaReacts} />
    </section>
  )
}
