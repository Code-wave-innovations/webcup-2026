import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { messageFor } from '../../api/errors'
import { useHome } from '../../api/home'
import type { Home } from '../../api/types'
import { ANNOUNCEMENT_CATEGORY_LABEL } from '../../api/announcements'
import { SCENE, SCENE_REASON_LABEL } from '../../a11y/sceneMode'
import { useAuthStore } from '../../features/auth/authStore'
import { availabilityView, formatShortMoment, plural } from '../../features/services/availability'
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

const SEVERITY_LABEL = { CRITICAL: 'Urgent', WARNING: 'Vigilance', INFO: 'Information' } as const

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

/** Says why the light version started by itself, so it never looks like a broken site. */
const reason = SCENE_REASON_LABEL[SCENE.reason]
const lead = `L'essentiel de Terra Nova, en version légère${reason ? ` (${reason.toLowerCase()})` : ''}. La version complète est à un clic, en haut de page.`

function LightHome({ firstName }: { firstName: string }) {
  const home = useHome()
  const data = home.data

  return (
    <ConsolePage home title={`Bonjour ${firstName}`} lead={lead}>
      {home.isError && <p className={text.error}>{messageFor(home.error)}</p>}
      {home.isPending && <p className={text.note}>Chargement de l'essentiel…</p>}
      {data && <Alerts alerts={data.alerts} />}
      {data?.me && <MySpace me={data.me} />}

      <Section id="actions" title="Accès rapide">
        <nav aria-label="Accès rapide" className={styles.quick}>
          <a href="#signaler">Signaler un problème</a>
          <a href="#catalogue">Tous les services</a>
          <Link to="/ville/transports">Transports</Link>
          <Link to="/ville/annonces">Annonces</Link>
          <Link to="/nova">Parler à Nova</Link>
        </nav>
      </Section>

      {data && <Disruptions home={data} />}

      <Section id="signaler" title="Signaler un problème">
        <OnDemand hash="#signaler" label="Ouvrir le formulaire de signalement">
          <ReportPanel />
        </OnDemand>
      </Section>

      <Section id="catalogue" title="Services">
        {data && <FeaturedServices services={data.featured_services} />}
        <OnDemand hash="#catalogue" label="Voir tout le catalogue">
          <ServiceShowcase />
        </OnDemand>
      </Section>

      <Section id="annonces" title="Dernières annonces">
        {data && <Announcements announcements={data.announcements} />}
        <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
          Toutes les annonces
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
function OnDemand({ hash, label, children }: { hash: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => window.location.hash === hash)

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === hash) setOpen(true)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [hash])

  if (open) return <Suspense fallback={<p className={text.note}>Chargement…</p>}>{children}</Suspense>
  return (
    <Button variant="ghost" onClick={() => setOpen(true)}>
      {label}
    </Button>
  )
}

/** Alerts that concern the visitor come first; the severity is written, never told by colour alone. */
function Alerts({ alerts }: { alerts: Home['alerts'] }) {
  if (alerts.length === 0) return null
  const sorted = [...alerts].sort((a, b) => Number(b.concerns_me) - Number(a.concerns_me))
  return (
    <Section id="alertes" title="Alertes en cours">
      <RowList>
        {sorted.map((alert) => (
          <Row key={alert.id}>
            <div>
              <small>
                {SEVERITY_LABEL[alert.severity]}
                {alert.concerns_me ? ' · Vous êtes concerné·e' : ''}
              </small>
              <strong>{alert.title}</strong>
              <small>{alert.message}</small>
            </div>
            <Pill tone={alert.severity === 'INFO' ? 'neutral' : 'alert'}>{SEVERITY_LABEL[alert.severity]}</Pill>
          </Row>
        ))}
      </RowList>
    </Section>
  )
}

function MySpace({ me }: { me: NonNullable<Home['me']> }) {
  const next = me.next_appointment
  return (
    <Section id="mon-espace" title="Mon espace">
      <ul className={styles.figures}>
        <li>
          <strong>{plural(me.open_requests, 'demande en cours', 'demandes en cours')}</strong>
          <a href="#signaler">Suivre mes demandes</a>
        </li>
        <li>
          <strong>{plural(me.unread_notifications, 'notification non lue', 'notifications non lues')}</strong>
        </li>
        <li>
          <strong>{next ? `Rendez-vous ${formatShortMoment(next.slot.starts_at)}` : 'Aucun rendez-vous à venir'}</strong>
          {next && (
            <small>
              {[next.slot.service?.name, next.slot.location].filter(Boolean).join(' · ')} · Réf. {next.reference}
            </small>
          )}
        </li>
      </ul>
    </Section>
  )
}

function Disruptions({ home }: { home: Home }) {
  const { service_disruptions: services, transit_disruptions: lines } = home
  if (services.length === 0 && lines.length === 0) return null
  return (
    <Section id="perturbations" title="Perturbations">
      <RowList>
        {services.map((interruption) => (
          <Row key={`s${interruption.id}`}>
            <div>
              <small>{interruption.impact === 'UNAVAILABLE' ? 'Service indisponible' : 'Service perturbé'}</small>
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
              <small>{line.status === 'INTERRUPTED' ? 'Ligne interrompue' : 'Ligne perturbée'}</small>
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
  if (services.length === 0) return <p className={text.note}>Aucun service mis en avant pour le moment.</p>
  return (
    <RowList>
      {services.map((service) => {
        const availability = availabilityView(service.availability)
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
  if (announcements.length === 0) return <p className={text.note}>Aucune annonce pour le moment.</p>
  return (
    <RowList>
      {announcements.map((announcement) => (
        <Row key={announcement.id}>
          <Link to={`/ville/annonces/${announcement.id}`}>
            <small>
              {announcement.service?.name ?? ANNOUNCEMENT_CATEGORY_LABEL[announcement.category]}
              {announcement.published_at ? `, ${formatPublished(announcement.published_at)}` : ''}
            </small>
            <strong>{announcement.title}</strong>
          </Link>
          {announcement.is_important && <Pill tone="alert">Importante</Pill>}
        </Row>
      ))}
    </RowList>
  )
}
