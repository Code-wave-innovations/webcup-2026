import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { SCENE, sceneReasonLabel } from '../../a11y/sceneMode'
import { announcementCategoryLabel } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { useHome } from '../../api/home'
import type { Home } from '../../api/types'
import { useAuthStore } from '../../features/auth/authStore'
import { stepsOf } from '../../lib/alertText'
import { availabilityView, formatShortMoment, plural } from '../../features/services/availability'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { formatPublished } from '../../lib/format'
import { Pill } from '../../ui/Badges'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { Row, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './LightHome.module.css'

/** downloaded only when their block is opened, with their animations (gsap) */
const ReportPanel = lazy(() => import('../../features/reports/ReportPanel').then((m) => ({ default: m.ReportPanel })))
const ServiceShowcase = lazy(() => import('../../features/services/ServiceShowcase').then((m) => ({ default: m.ServiceShowcase })))

const messages = defineMessages(
  {
    hello: (name: string) => `Bonjour ${name}`,
    lead: (reason: string | null) =>
      `L'essentiel de Terra Nova, en version légère${reason ? ` (${reason.toLowerCase()})` : ''}. La version complète est à un clic, en haut de page.`,
    loading: "Chargement de l'essentiel…",
    loadingBlock: 'Chargement…',
    quick: 'Accès rapide',
    report: 'Signaler un problème',
    allServices: 'Tous les services',
    transports: 'Transports',
    announcements: 'Annonces',
    talkNova: 'Parler à Nova',
    reportSection: 'Signaler un problème',
    openReport: 'Ouvrir le formulaire de signalement',
    services: 'Services',
    seeCatalogue: 'Voir tout le catalogue',
    latestAnnouncements: 'Dernières annonces',
    allAnnouncements: 'Toutes les annonces',
    alerts: 'Alertes en cours',
    concernsYou: ' · Vous êtes concerné·e',
    severity: { CRITICAL: 'Urgent', WARNING: 'Vigilance', INFO: 'Information' },
    mySpace: 'Mon espace',
    openRequest: 'demande en cours',
    openRequests: 'demandes en cours',
    followRequests: 'Suivre mes demandes',
    unreadOne: 'notification non lue',
    unreadMany: 'notifications non lues',
    appointment: (when: string) => `Rendez-vous ${when}`,
    noAppointment: 'Aucun rendez-vous à venir',
    ref: (reference: string) => `Réf. ${reference}`,
    disruptions: 'Perturbations',
    serviceDown: 'Service indisponible',
    serviceDegraded: 'Service perturbé',
    lineDown: 'Ligne interrompue',
    lineDegraded: 'Ligne perturbée',
    noFeatured: 'Aucun service mis en avant pour le moment.',
    noAnnouncements: 'Aucune annonce pour le moment.',
    important: 'Importante',
  },
  {
    hello: (name) => `Hello ${name}`,
    lead: (reason) =>
      `The essentials of Terra Nova, in the light version${reason ? ` (${reason.toLowerCase()})` : ''}. The full version is one click away, at the top of the page.`,
    loading: 'Loading the essentials…',
    loadingBlock: 'Loading…',
    quick: 'Quick access',
    report: 'Report a problem',
    allServices: 'All services',
    transports: 'Transport',
    announcements: 'Announcements',
    talkNova: 'Talk to Nova',
    reportSection: 'Report a problem',
    openReport: 'Open the report form',
    services: 'Services',
    seeCatalogue: 'See the full catalogue',
    latestAnnouncements: 'Latest announcements',
    allAnnouncements: 'All announcements',
    alerts: 'Current alerts',
    concernsYou: ' · This concerns you',
    severity: { CRITICAL: 'Urgent', WARNING: 'Warning', INFO: 'Information' },
    mySpace: 'My space',
    openRequest: 'open request',
    openRequests: 'open requests',
    followRequests: 'Follow my requests',
    unreadOne: 'unread notification',
    unreadMany: 'unread notifications',
    appointment: (when) => `Appointment ${when}`,
    noAppointment: 'No upcoming appointment',
    ref: (reference) => `Ref. ${reference}`,
    disruptions: 'Disruptions',
    serviceDown: 'Service unavailable',
    serviceDegraded: 'Service disrupted',
    lineDown: 'Line suspended',
    lineDegraded: 'Line disrupted',
    noFeatured: 'No featured service right now.',
    noAnnouncements: 'No announcements for now.',
    important: 'Important',
  },
)

/**
 * F96: the city's home in the light version. The essentials first, as one readable column, from a single
 * `GET /api/home`; the report form and the full catalogue only load when asked for.
 * Same functions as the flyover (D20), without the 3D, the simulated gauges or the decorative registry.
 */
export default function LightHomePage() {
  const session = useAuthStore((s) => s.session)
  const { search } = useLocation()
  if (!session) return <Navigate to={{ pathname: '/', search }} replace />
  return <LightHome firstName={session.name} />
}

function LightHome({ firstName }: { firstName: string }) {
  const home = useHome()
  const data = home.data
  const m = useMessages(messages)
  const locale = useLocale()
  const reason = sceneReasonLabel(SCENE.reason, locale)

  return (
    <ConsolePage home title={m.hello(firstName)} lead={m.lead(reason)}>
      {home.isError && <p className={text.error}>{messageFor(home.error)}</p>}
      {home.isPending && <p className={text.note}>{m.loading}</p>}
      {data && <Alerts alerts={data.alerts} />}
      {data?.me && <MySpace me={data.me} />}

      <Section id="actions" title={m.quick}>
        <nav aria-label={m.quick} className={styles.quick}>
          <a href="#signaler">{m.report}</a>
          <a href="#catalogue">{m.allServices}</a>
          <Link to="/ville/transports">{m.transports}</Link>
          <Link to="/ville/annonces">{m.announcements}</Link>
          <Link to="/nova">{m.talkNova}</Link>
        </nav>
      </Section>

      {data && <Disruptions home={data} />}

      <Section id="signaler" title={m.reportSection}>
        <OnDemand hash="#signaler" label={m.openReport} loading={m.loadingBlock}>
          <ReportPanel />
        </OnDemand>
      </Section>

      <Section id="catalogue" title={m.services}>
        {data && <FeaturedServices services={data.featured_services} />}
        <OnDemand hash="#catalogue" label={m.seeCatalogue} loading={m.loadingBlock}>
          <ServiceShowcase />
        </OnDemand>
      </Section>

      <Section id="annonces" title={m.latestAnnouncements}>
        {data && <Announcements announcements={data.announcements} />}
        <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
          {m.allAnnouncements}
        </ButtonRouteLink>
      </Section>
    </ConsolePage>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className={styles.section}>
      <h2 id={`${id}-titre`} className={styles.heading}>
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Heavier blocks (form, full catalogue) are mounted, and their data fetched, only when the visitor opens them,
 * with the button or by following a link to `hash` (« Signaler un problème », « Suivre mes demandes »).
 */
function OnDemand({ hash, label, loading, children }: { hash: string; label: string; loading: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => window.location.hash === hash)

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === hash) setOpen(true)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [hash])

  if (open) return <Suspense fallback={<p className={text.note}>{loading}</p>}>{children}</Suspense>
  return (
    <Button variant="ghost" onClick={() => setOpen(true)}>
      {label}
    </Button>
  )
}

/** Alerts that concern the visitor come first; the severity is written, never told by colour alone. */
function Alerts({ alerts }: { alerts: Home['alerts'] }) {
  const m = useMessages(messages)
  if (alerts.length === 0) return null
  const sorted = [...alerts].sort((a, b) => Number(b.concerns_me) - Number(a.concerns_me))
  return (
    <Section id="alertes" title={m.alerts}>
      <RowList>
        {sorted.map((alert) => (
          <Row key={alert.id}>
            <div>
              <small>
                {m.severity[alert.severity]}
                {alert.concerns_me ? m.concernsYou : ''}
              </small>
              <strong>{alert.title}</strong>
              <small>{alert.message}</small>
              {alert.concerns_me && stepsOf(alert.instructions)[0] && <small>À faire : {stepsOf(alert.instructions)[0]}</small>}
              {!alert.concerns_me && <small>Ne concerne pas votre quartier</small>}
            </div>
            <Pill tone={alert.severity === 'INFO' ? 'neutral' : 'alert'}>{m.severity[alert.severity]}</Pill>
          </Row>
        ))}
      </RowList>
    </Section>
  )
}

function MySpace({ me }: { me: NonNullable<Home['me']> }) {
  const m = useMessages(messages)
  const locale = useLocale()
  const next = me.next_appointment
  return (
    <Section id="mon-espace" title={m.mySpace}>
      <ul className={styles.figures}>
        <li>
          <strong>{plural(me.open_requests, m.openRequest, m.openRequests, locale)}</strong>
          <a href="#signaler">{m.followRequests}</a>
        </li>
        <li>
          <strong>{plural(me.unread_notifications, m.unreadOne, m.unreadMany, locale)}</strong>
        </li>
        <li>
          <strong>{next ? m.appointment(formatShortMoment(next.slot.starts_at, locale)) : m.noAppointment}</strong>
          {next && (
            <small>
              {[next.slot.service?.name, next.slot.location].filter(Boolean).join(' · ')} · {m.ref(next.reference)}
            </small>
          )}
        </li>
      </ul>
    </Section>
  )
}

function Disruptions({ home }: { home: Home }) {
  const m = useMessages(messages)
  const { service_disruptions: services, transit_disruptions: lines } = home
  if (services.length === 0 && lines.length === 0) return null
  return (
    <Section id="perturbations" title={m.disruptions}>
      <RowList>
        {services.map((interruption) => (
          <Row key={`s${interruption.id}`}>
            <div>
              <small>{interruption.impact === 'UNAVAILABLE' ? m.serviceDown : m.serviceDegraded}</small>
              <strong>{interruption.service.name}</strong>
              <small>
                {interruption.reason}
                {interruption.alternative ? ` · ${interruption.alternative}` : ''}
              </small>
            </div>
          </Row>
        ))}
        {lines.map((line) => (
          <Row key={`l${line.id}`}>
            <Link to="/ville/transports">
              <small>{line.status === 'INTERRUPTED' ? m.lineDown : m.lineDegraded}</small>
              <strong>
                {line.code} · {line.name}
              </strong>
              {line.status_message && <small>{line.status_message}</small>}
            </Link>
          </Row>
        ))}
      </RowList>
    </Section>
  )
}

function FeaturedServices({ services }: { services: Home['featured_services'] }) {
  const m = useMessages(messages)
  const locale = useLocale()
  if (services.length === 0) return <p className={text.note}>{m.noFeatured}</p>
  return (
    <RowList>
      {services.map((service) => {
        const availability = availabilityView(service.availability, locale)
        return (
          <Row key={service.id}>
            <div>
              <strong>{service.name}</strong>
              <small>{availability.detail ?? service.summary}</small>
            </div>
            <Pill tone={availability.tone}>{availability.label}</Pill>
          </Row>
        )
      })}
    </RowList>
  )
}

function Announcements({ announcements }: { announcements: Home['announcements'] }) {
  const m = useMessages(messages)
  const locale = useLocale()
  if (announcements.length === 0) return <p className={text.note}>{m.noAnnouncements}</p>
  return (
    <RowList>
      {announcements.map((announcement) => (
        <Row key={announcement.id}>
          <Link to={`/ville/annonces/${announcement.id}`}>
            <small>
              {announcement.service?.name ?? announcementCategoryLabel(announcement.category, locale)}
              {announcement.published_at ? `, ${formatPublished(announcement.published_at, locale)}` : ''}
            </small>
            <strong>{announcement.title}</strong>
          </Link>
          {announcement.is_important && <Pill tone="alert">{m.important}</Pill>}
        </Row>
      ))}
    </RowList>
  )
}
