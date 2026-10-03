import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { director } from '../../experience/director/director'
import { useDirectorStore } from '../../experience/director/directorStore'
import { AlertBanner } from '../../features/announcements/AlertBanner'
import { AnnouncementList } from '../../features/announcements/AnnouncementList'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { CityGauges } from '../../features/cityStatus/CityGauges'
import { RegistryPanel } from '../../features/registry/RegistryPanel'
import { ReportPanel } from '../../features/reports/ReportPanel'
import { useReportStore } from '../../features/reports/reportStore'
import { ServiceList } from '../../features/services/ServiceList'
import { useBodyClass } from '../../hooks/useBodyClass'
import { PHONE_QUERY, useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery'
import { ButtonLink } from '../../ui/Button'
import { LinkLine, RouteRail, TopBar } from './CityChrome'
import { CitySection } from './CitySection'
import { CITY_SECTIONS } from './citySections'
import { useCityScroll } from './useCityScroll'
import styles from './CityPage.module.css'

const LEAVE_MS = 700
const [ARRIVAL, SERVICES, REPORT, STATUS, COUNCIL, REGISTRY] = CITY_SECTIONS
const sectionIndex = (id: string) => CITY_SECTIONS.findIndex((s) => s.id === id)

/** Acts III and IV: the city. Requires a session; without one, back to the airlock. */
export function CityPage() {
  const session = useAuthStore((s) => s.session)
  const { search } = useLocation()
  if (!session) return <Navigate to={{ pathname: '/', search }} replace />
  return <CityView session={session} />
}

function CityView({ session }: { session: Session }) {
  const status = useDirectorStore((s) => s.status)
  const phase = useDirectorStore((s) => s.phase)
  const alert = useDirectorStore((s) => s.alert)
  const arrived = phase === 'city'
  const [leaving, setLeaving] = useState(false)
  const reduced = useReducedMotion()
  const phone = useMediaQuery(PHONE_QUERY)
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { active, scrollTo, live } = useCityScroll(rootRef, arrived && !leaving)
  useBodyClass('is-locked', !arrived || leaving)

  // reload or deep link while the film still waits in the cockpit: land straight in the city
  useEffect(() => {
    const store = useDirectorStore.getState()
    if (status === 'ready' && director.phase === 'approach') director.land()
    else if (status === 'unsupported' && store.phase !== 'city') store.setPhase('city')
  }, [status])

  // arrival: top of the page, focus on the title for keyboard and screen reader users
  useEffect(() => {
    if (!arrived) return
    window.scrollTo(0, 0)
    const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [arrived])

  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  const quit = () => {
    setLeaving(true)
    const store = useDirectorStore.getState()
    store.setAlert(false)
    leaveTimer.current = setTimeout(
      () => {
        useReportStore.getState().reset()
        if (store.status === 'ready') director.exit()
        else store.setPhase('approach')
        useAuthStore.getState().signOut()
        navigate('/')
      },
      reduced ? 0 : LEAVE_MS,
    )
  }

  // every in-page link flies the camera to its district instead of jumping
  const onClick = (event: MouseEvent) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]')
    if (link && scrollTo(link.hash.slice(1))) event.preventDefault()
  }

  return (
    <div ref={rootRef} className={[styles.city, arrived && !leaving && styles.visible].filter(Boolean).join(' ')} hidden={!arrived} onClick={onClick}>
      <TopBar session={session} active={active} alert={alert} onQuit={quit} />
      <AlertBanner />
      <RouteRail active={active} />
      <LinkLine live={live} phone={phone} />

      <main>
        <section className={`${styles.section} ${styles.arrival}`} id={ARRIVAL.id} data-city-section aria-labelledby="arrival-title">
          <div className={styles.frame}>
            <div className={styles.column} data-column>
              <p className={styles.greeting}>Bienvenue, {session.name}.</p>
              <h1 ref={headingRef} className={styles.headline} id="arrival-title" tabIndex={-1}>
                Le cœur numérique de&nbsp;Terra&nbsp;Nova
              </h1>
              <p className={styles.lead}>
                Signalez un problème, suivez sa résolution, accédez aux services de la ville. Faites défiler&nbsp;: vous survolez Terra Nova pendant
                que le soleil se couche.
              </p>
              <div className={styles.actions}>
                <ButtonLink href={`#${REPORT.id}`}>Signaler un problème</ButtonLink>
                <ButtonLink variant="ghost" href={`#${SERVICES.id}`}>
                  Survoler la ville
                </ButtonLink>
              </div>
            </div>
            <div className={styles.scrollHint} data-scroll-hint aria-hidden="true">
              <span>Faites défiler</span>
              <i />
            </div>
          </div>
        </section>

        <CitySection
          info={SERVICES}
          side="right"
          title="Tous les services, sous un même dôme"
          lead={'Santé, logement, eau, énergie, formation\u00a0: chaque service de la ville a son guichet, ouvert jour et nuit.'}
        >
          <ServiceList />
        </CitySection>

        <CitySection
          info={REPORT}
          side="left"
          title={<>Un problème&nbsp;? Dites‑le en une phrase</>}
          lead="Votre demande part au Haut Conseil. Un faisceau s'allume au-dessus du secteur concerné."
        >
          <ReportPanel />
        </CitySection>

        <CitySection
          info={STATUS}
          side="right"
          title="La ville respire, vous le voyez"
          lead={"Air, eau, énergie\u00a0: les réserves de Terra Nova, lisibles d'un coup d'œil par tous les habitants."}
        >
          <CityGauges visible={active === sectionIndex(STATUS.id)} />
        </CitySection>

        <CitySection
          info={COUNCIL}
          side="left"
          title="Le Haut Conseil parle à toute la ville"
          lead={'Annonces, consignes, alertes\u00a0: un seul canal, visible sur tous les écrans.'}
        >
          <AnnouncementList />
        </CitySection>

        <CitySection
          info={REGISTRY}
          side="right"
          title="Chaque demande, une preuve"
          lead="Le registre relie chaque demande reçue à la fonctionnalité livrée. Le jury vérifie en un clic."
        >
          <RegistryPanel visible={active === sectionIndex(REGISTRY.id)} />
        </CitySection>
      </main>

      <footer className={styles.footer}>
        <span>NOVA, plateforme de Terra Nova. Maquette de démonstration, données simulées.</span>
        <span>24H by Webcup 2026</span>
      </footer>
    </div>
  )
}
