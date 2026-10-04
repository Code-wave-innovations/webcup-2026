import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import { debugJump, debugParams } from '../../experience/director/debugParams'
import { director } from '../../experience/director/director'
import { useSmoothScroll } from '../../app/smoothScroll'
import { useDirectorStore } from '../../experience/director/directorStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import { AnnouncementList } from '../../features/announcements/AnnouncementList'
import { ContactPanel } from '../../features/contact/ContactPanel'
import { filmSessionFromCitizen, type Session } from '../../features/auth/authService'
import { useMaintenanceMode } from '../../features/maintenance/maintenanceMode'
import { PlatformIncident } from '../../features/maintenance/PlatformIncident'
import { useAuthStore } from '../../features/auth/authStore'
import { CityGauges } from '../../features/cityStatus/CityGauges'
import { RegistryPanel } from '../../features/registry/RegistryPanel'
import { ReportPanel } from '../../features/reports/ReportPanel'
import { useReportStore } from '../../features/reports/reportStore'
import { QuickServices, ServiceShowcase } from '../../features/services/ServiceShowcase'
import { useBodyClass } from '../../hooks/useBodyClass'
import { PHONE_QUERY, useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery'
import { ButtonLink } from '../../ui/Button'
import { NovaInvite } from './NovaInvite'
import { ExploreHud } from '../../experience/city/explore/ExploreHud'
import { exploreActions } from '../../experience/city/explore/exploreActions'
import { LinkLine, RouteRail, TopBar } from './CityChrome'
import { CitySection } from './CitySection'
import { CITY_SECTIONS } from './citySections'
import { useCityScroll } from './useCityScroll'
import { useHeroReveal } from './useHeroReveal'
import { useNovaCityReactions } from './useNovaCityReactions'
import styles from './CityPage.module.css'

/** Nova's wave goodbye, before the fade to black */
const LEAVE_MS = 1300
const [ARRIVAL, SERVICES, REPORT, STATUS, COUNCIL, OBSERVATORY, REGISTRY] = CITY_SECTIONS
const sectionIndex = (id: string) => CITY_SECTIONS.findIndex((s) => s.id === id)

/** Acts III and IV: the city. Requires a session; without one, back to the airlock. */
export function CityPage() {
  const film = useAuthStore((s) => s.session)
  const citizen = useCitizenUser()
  // Citizen JWT wins when both exist (API login mirrors into film + citizen).
  const session = citizen ? filmSessionFromCitizen(citizen) : film
  const { search } = useLocation()
  // a debug jump signs in by itself once the film has landed
  if (!session) return debugJump ? null : <Navigate to={{ pathname: '/', search }} replace />
  return <CityView session={session} />
}

function CityView({ session }: { session: Session }) {
  const readOnly = useMaintenanceMode()
  const status = useDirectorStore((s) => s.status)
  const phase = useDirectorStore((s) => s.phase)
  const alert = useDirectorStore((s) => s.alert)
  const exploring = phase === 'explore'
  const arrived = phase === 'city' || exploring
  const [leaving, setLeaving] = useState(false)
  const reduced = useReducedMotion()
  const phone = useMediaQuery(PHONE_QUERY)
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { active, scrollTo, live } = useCityScroll(rootRef, arrived && !leaving && !exploring)
  useBodyClass('is-locked', !arrived || leaving || exploring)
  useHeroReveal(rootRef, arrived, reduced)
  useSmoothScroll(arrived && !leaving && !exploring && !reduced)
  useNovaCityReactions()

  // Nova walks into the frame and welcomes the resident
  useEffect(() => {
    if (arrived) return novaScenes.welcomeToCity(session.name, reduced)
  }, [arrived, session.name, reduced])

  // reload or deep link while the film still waits in the cockpit: land straight in the city
  useEffect(() => {
    const store = useDirectorStore.getState()
    if (status === 'ready' && director.phase === 'approach') director.land()
    else if (status === 'unsupported' && store.phase !== 'city') store.setPhase('city')
  }, [status])

  // arrival: top of the page (or the section in the URL hash, or the `?vue` one), focus on the title
  const { hash } = useLocation()
  useEffect(() => {
    if (!arrived) return
    const id = hash.slice(1) || (debugParams.view ? CITY_SECTIONS[Math.round(debugParams.view)]?.id : '')
    const view = id ? document.getElementById(id) : null
    window.scrollTo(0, view ? view.getBoundingClientRect().top + window.scrollY : 0)
    // `?site=golf`: straight onto a site (screenshots of the explore mode)
    if (debugParams.site) director.enterExplore(debugParams.site, true)
    const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only on arrival, not when the hash changes while reading
  }, [arrived])

  useEffect(() => () => {
    clearTimeout(leaveTimer.current)
    director.exitExplore(true)
  }, [])

  const quit = () => {
    setLeaving(true)
    if (!reduced) novaScenes.farewell(session.name)
    const store = useDirectorStore.getState()
    store.setAlert(false)
    leaveTimer.current = setTimeout(
      () => {
        useReportStore.getState().reset()
        if (store.status === 'ready') director.exit()
        else store.setPhase('approach')
        useAuthStore.getState().signOut()
        signOutCitizen()
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
    <div
      ref={rootRef}
      className={[styles.city, arrived && !leaving && styles.visible, exploring && styles.exploring].filter(Boolean).join(' ')}
      hidden={!arrived}
      onClick={onClick}
    >
      <TopBar
        session={session}
        active={active}
        alert={alert}
        exploring={exploring}
        onQuit={quit}
        onToggleExplore={() => (exploring ? exploreActions.leave() : exploreActions.enter())}
      />
      {!exploring && <RouteRail active={active} />}
      {!exploring && <LinkLine live={live} phone={phone} />}
      <ExploreHud exploring={exploring} ready={status === 'ready' && arrived && !leaving} phone={phone} />

      <main inert={exploring}>
        <section className={`${styles.section} ${styles.arrival}`} id={ARRIVAL.id} data-city-section aria-labelledby="arrival-title">
          <div className={styles.frame}>
            <div className={styles.column} data-column>
              <p className={styles.greeting} data-reveal="rest">
                Bienvenue, {session.name}.
              </p>
              <h1 ref={headingRef} className={styles.headline} id="arrival-title" tabIndex={-1} data-reveal="headline">
                Le cœur numérique de&nbsp;Terra&nbsp;Nova
              </h1>
              {readOnly && <PlatformIncident />}
              <p className={styles.lead} data-reveal="rest">
                {readOnly
                  ? 'L’envoi de demandes est suspendu. Les services, les annonces, les consignes et les coordonnées restent consultables.'
                  : 'Signalez un problème, suivez sa résolution, accédez aux services de la ville. Faites défiler\u00a0: vous survolez Terra Nova pendant que le soleil se couche.'}
              </p>
              <div className={styles.actions} data-reveal="rest">
                {readOnly ? (
                  <>
                    <ButtonLink href={`#${SERVICES.id}`} magnetic data-nova-look>
                      Consulter les services
                    </ButtonLink>
                    <ButtonLink variant="ghost" href={`#${COUNCIL.id}`} magnetic data-nova-look>
                      Annonces et consignes
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <ButtonLink href={`#${REPORT.id}`} magnetic data-nova-look>
                      Signaler un problème
                    </ButtonLink>
                    <ButtonLink variant="ghost" href={`#${COUNCIL.id}`} magnetic data-nova-look>
                      Écrire à la mairie
                    </ButtonLink>
                  </>
                )}
              </div>
              <QuickServices />
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
          lead={"Les services prioritaires d'abord, leur état en direct. Ouvrez un guichet pour voir ses horaires, ses contacts et ses démarches."}
        >
          <ServiceShowcase />
        </CitySection>

        <CitySection
          info={REPORT}
          side="left"
          title={readOnly ? 'Signalement en pause' : <>Un problème&nbsp;? Dites‑le en une phrase</>}
          lead={
            readOnly
              ? 'Pendant l’incident, un nouveau signalement ne part pas. Les consignes et les coordonnées sont à l’arrivée, et les annonces à la Tour du Conseil.'
              : "Votre demande part au Haut Conseil. Un faisceau s'allume au-dessus du secteur concerné."
          }
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
          title={readOnly ? 'Annonces et consignes' : <>Une question&nbsp;? Écrivez à la mairie</>}
          lead={
            readOnly
              ? 'Le message à la mairie est en pause. Les annonces et les alertes restent affichées ici.'
              : 'Depuis la Tour du Conseil, votre message part aux services municipaux. Les annonces de la ville restent visibles juste en dessous.'
          }
        >
          <ContactPanel />
          <AnnouncementList />
        </CitySection>

        <CitySection
          info={OBSERVATORY}
          side="right"
          title="Parlez à Nova, sous les étoiles"
          lead="Une question sur la ville, une démarche, votre demande en cours : Nova vous répond, de jour comme de nuit."
        >
          <NovaInvite />
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
