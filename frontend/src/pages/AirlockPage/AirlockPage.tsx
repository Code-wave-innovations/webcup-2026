import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { director } from '../../experience/director/director'
import { useDirectorStore } from '../../experience/director/directorStore'
import { AccessHologram } from '../../features/auth/AccessHologram'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { useBodyClass } from '../../hooks/useBodyClass'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { useTypewriter } from '../../ui/useTypewriter'
import { ProjectorBeam, Reticle, Telemetry } from './CockpitOverlay'
import styles from './AirlockPage.module.css'

const RADIO_APPROACH = "Vaisseau en approche de Terra Nova. Identifiez-vous pour recevoir un couloir d'entrée."
const RADIO_CLEARED = "Identité confirmée. Entrée dans l'atmosphère dans quelques secondes, tenez-vous prêts."

type Step = 'login' | 'granted' | 'departing'

/** Act I: the cockpit in orbit. The visitor identifies, then the ship enters the atmosphere. */
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
  const hologramRef = useRef<HTMLFormElement>(null)
  const departure = useRef<ReturnType<typeof setTimeout>>(undefined)

  // the film reached the surface: the city takes over
  useEffect(() => {
    if (session && (phase === 'descent' || phase === 'city')) navigate({ pathname: '/ville', search })
  }, [session, phase, navigate, search])

  useEffect(() => () => clearTimeout(departure.current), [])

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
      reduced ? 300 : 1300,
    )
  }

  const radio = useTypewriter(step === 'login' ? (status === 'loading' ? '' : RADIO_APPROACH) : RADIO_CLEARED)

  return (
    <section className={[styles.airlock, step === 'departing' && styles.departing].filter(Boolean).join(' ')} aria-labelledby="airlock-title">
      <p className={styles.radio} aria-live="polite">
        <b>Contrôle d'approche</b>
        <span>{radio}</span>
      </p>
      <Telemetry />
      <Reticle hidden={step !== 'login'} />
      <AccessHologram formRef={hologramRef} collapsed={step === 'departing'} onGranted={onGranted} />
      {step !== 'departing' && <ProjectorBeam hologram={hologramRef} />}
      <p className={styles.note}>Démonstration : le code est vérifié dans la page. Dans l'application, la vérification se fait sur le serveur.</p>
    </section>
  )
}
