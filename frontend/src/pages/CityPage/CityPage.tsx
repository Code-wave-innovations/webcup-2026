import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import { debugJump, debugParams } from '../../experience/director/debugParams'
import { director } from '../../experience/director/director'
import { useSmoothScroll } from '../../app/smoothScroll'
import { useDirectorStore } from '../../experience/director/directorStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import { AnnouncementList } from '../../features/announcements/AnnouncementList'
import { filmSessionFromCitizen, type Session } from '../../features/auth/authService'
import { useMaintenanceMode } from '../../features/maintenance/maintenanceMode'
import { PlatformIncident } from '../../features/maintenance/PlatformIncident'
import { useAuthStore } from '../../features/auth/authStore'
import { CityGauges } from '../../features/cityStatus/CityGauges'
import { RegistryPanel } from '../../features/registry/RegistryPanel'
import { ReportPanel } from '../../features/reports/ReportPanel'
import { useReportStore } from '../../features/reports/reportStore'
import { NextAppointment } from '../../features/appointments/NextAppointment'
import { QuickServices, ServiceShowcase } from '../../features/services/ServiceShowcase'
import { TransitGlance } from '../../features/transit/TransitGlance'
import { useBodyClass } from '../../hooks/useBodyClass'
import { PHONE_QUERY, useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery'
import { ButtonLink, ButtonRouteLink } from '../../ui/Button'
import { NovaInvite } from './NovaInvite'
import { ExploreHud } from '../../experience/city/explore/ExploreHud'
import { exploreActions } from '../../experience/city/explore/exploreActions'
import { LinkLine, RouteRail, TopBar } from './CityChrome'
import { CitySection } from './CitySection'
import { CITY_SECTIONS } from './citySections'
import { useCityScroll } from './useCityScroll'
import { useHeroReveal } from './useHeroReveal'
import { defineMessages, useMessages } from '../../i18n'
import { useNovaCityReactions } from './useNovaCityReactions'
import styles from './CityPage.module.css'

const messages = defineMessages(
  {
    welcome: (name: string) => `Bienvenue, ${name}.`,
    headline: 'Le cœur numérique de\u00a0Terra\u00a0Nova',
    leadPaused: 'L’envoi de demandes est suspendu. Les services, les annonces, les consignes et les coordonnées restent consultables.',
    lead: 'Signalez un problème, suivez sa résolution, accédez aux services de la ville. Faites défiler\u00a0: vous survolez Terra Nova pendant que le soleil se couche.',
    browseServices: 'Consulter les services',
    announcements: 'Annonces et consignes',
    report: 'Signaler un problème',
    writeTownHall: 'Écrire à la mairie',
    scroll: 'Faites défiler',
    servicesTitle: 'Tous les services, sous un même dôme',
    servicesLead: "Les services prioritaires d'abord, leur état en direct. Ouvrez un guichet pour voir ses horaires, ses contacts et ses démarches.",
    reportTitlePaused: 'Signalement en pause',
    reportTitle: 'Un problème\u00a0? Dites‑le en une phrase',
    reportLeadPaused: 'Pendant l’incident, un nouveau signalement ne part pas. Les consignes et les coordonnées sont à l’arrivée, et les annonces à la Tour du Conseil.',
    reportLead: "Votre demande part au Haut Conseil. Un faisceau s'allume au-dessus du secteur concerné.",
    statusTitle: 'La ville respire, vous le voyez',
    statusLead: "Air, eau, énergie\u00a0: les réserves de Terra Nova, lisibles d'un coup d'œil par tous les habitants.",
    councilTitlePaused: 'Annonces et consignes',
    councilTitle: 'Le Haut Conseil parle à toute la ville',
    councilLeadPaused: 'Le message à la mairie est en pause. Les annonces et les alertes restent affichées ici.',
    councilLead: 'Annonces, consignes, alertes\u00a0: un seul canal, visible sur tous les écrans.',
    novaTitle: 'Parlez à Nova, sous les étoiles',
    novaLead: 'Une question sur la ville, une démarche, votre demande en cours : Nova vous répond, de jour comme de nuit.',
    registryTitle: 'Chaque demande, une preuve',
    registryLead: 'Le registre relie chaque demande reçue à la fonctionnalité livrée. Le jury vérifie en un clic.',
    footer: 'NOVA, plateforme de Terra Nova. Maquette de démonstration, données simulées.',
  },
  {
    welcome: (name) => `Welcome, ${name}.`,
    headline: 'The digital heart of\u00a0Terra\u00a0Nova',
    leadPaused: 'Sending requests is suspended. Services, announcements, instructions and contact details remain available.',
    lead: 'Report a problem, follow its resolution, reach the city’s services. Scroll down: you are flying over Terra Nova as the sun sets.',
    browseServices: 'Browse the services',
    announcements: 'Announcements and instructions',
    report: 'Report a problem',
    writeTownHall: 'Write to the city hall',
    scroll: 'Scroll down',
    servicesTitle: 'Every service, under one dome',
    servicesLead: 'Priority services first, with their live status. Open a counter to see its opening hours, contacts and procedures.',
    reportTitlePaused: 'Reporting paused',
    reportTitle: 'A problem? Tell us in one sentence',
    reportLeadPaused: 'During the incident, new reports cannot be sent. Instructions and contact details are at the arrival, and announcements at the Council Tower.',
    reportLead: 'Your request goes to the High Council. A beam lights up above the district concerned.',
    statusTitle: 'The city breathes, and you can see it',
    statusLead: 'Air, water, energy: Terra Nova’s reserves, readable at a glance by every resident.',
    councilTitlePaused: 'Announcements and instructions',
    councilTitle: 'The High Council speaks to the whole city',
    councilLeadPaused: 'Messages to the city hall are paused. Announcements and alerts are still shown here.',
    councilLead: 'Announcements, instructions, alerts: one channel, visible on every screen.',
    novaTitle: 'Talk to Nova, under the stars',
    novaLead: 'A question about the city, a procedure, your request in progress: Nova answers, day and night.',
    registryTitle: 'Every request, a proof',
    registryLead: 'The registry links every request received to the feature delivered. The jury checks in one click.',
    footer: 'NOVA, the Terra Nova platform. Demonstration mock-up, simulated data.',
  },
)

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
  const m = useMessages(messages)
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
                {m.welcome(session.name)}
              </p>
              <h1 ref={headingRef} className={styles.headline} id="arrival-title" tabIndex={-1} data-reveal="headline">
                {m.headline}
              </h1>
              {readOnly && <PlatformIncident />}
              <p className={styles.lead} data-reveal="rest">
                {readOnly ? m.leadPaused : m.lead}
              </p>
              <div className={styles.actions} data-reveal="rest">
                {readOnly ? (
                  <>
                    <ButtonLink href={`#${SERVICES.id}`} magnetic data-nova-look>
                      {m.browseServices}
                    </ButtonLink>
                    <ButtonLink variant="ghost" href={`#${COUNCIL.id}`} magnetic data-nova-look>
                      {m.announcements}
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <ButtonLink href={`#${REPORT.id}`} magnetic data-nova-look>
                      {m.report}
                    </ButtonLink>
                    <ButtonRouteLink variant="ghost" to="/ville/contact" data-nova-look>
                      {m.writeTownHall}
                    </ButtonRouteLink>
                  </>
                )}
              </div>
              <QuickServices />
              <NextAppointment />
            </div>
            <div className={styles.scrollHint} data-scroll-hint aria-hidden="true">
              <span>{m.scroll}</span>
              <i />
            </div>
          </div>
        </section>

        <CitySection
          info={SERVICES}
          side="right"
          title={m.servicesTitle}
          lead={m.servicesLead}
        >
          <ServiceShowcase />
        </CitySection>

        <CitySection
          info={REPORT}
          side="left"
          compact
          title={readOnly ? m.reportTitlePaused : m.reportTitle}
          lead={readOnly ? m.reportLeadPaused : m.reportLead}
        >
          <ReportPanel />
        </CitySection>

        <CitySection
          info={STATUS}
          side="right"
          title={m.statusTitle}
          lead={m.statusLead}
        >
          <CityGauges visible={active === sectionIndex(STATUS.id)} />
          <TransitGlance />
        </CitySection>

        <CitySection
          info={COUNCIL}
          side="left"
          title={readOnly ? m.councilTitlePaused : m.councilTitle}
          lead={readOnly ? m.councilLeadPaused : m.councilLead}
        >
          <AnnouncementList />
        </CitySection>

        <CitySection
          info={OBSERVATORY}
          side="right"
          title={m.novaTitle}
          lead={m.novaLead}
        >
          <NovaInvite />
        </CitySection>

        <CitySection
          info={REGISTRY}
          side="right"
          title={m.registryTitle}
          lead={m.registryLead}
        >
          <RegistryPanel visible={active === sectionIndex(REGISTRY.id)} />
        </CitySection>
      </main>

      <footer className={styles.footer}>
        <span>{m.footer}</span>
        <span>24H by Webcup 2026</span>
      </footer>
    </div>
  )
}
