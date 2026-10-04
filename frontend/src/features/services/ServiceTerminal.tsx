import { useEffect, useId, useRef, useState, type AnimationEvent, type CSSProperties, type MouseEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useSlots } from '../../api/appointments'
import { messageFor } from '../../api/errors'
import { isNetworkFailure } from '../../api/essentialCache'
import { useProcedures } from '../../api/procedures'
import { useCatalogue, useService, useServiceCategories } from '../../api/services'
import type { CityService, Procedure, ServiceDetail } from '../../api/types'
import { holdSmoothScroll } from '../../app/smoothScroll'
import { useBodyClass } from '../../hooks/useBodyClass'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { Plate } from '../../ui/Badges'
import { Icon, NovaMark, type IconName } from '../../ui/Icon'
import { useTypewriter } from '../../ui/useTypewriter'
import { availabilityView, formatDelay, formatMoment, plural } from './availability'
import { ServiceGlyph } from './ServiceGlyph'
import styles from './ServiceTerminal.module.css'

export interface TerminalTarget {
  /** category slug of the catalogue view; null: every category */
  category: string | null
  /** the service whose sheet opens; null: the catalogue */
  service: CityService | null
  /** offset of the click from the middle of the screen: the hologram is projected from there */
  origin: { x: number; y: number }
}

type View = Omit<TerminalTarget, 'origin'>

/** The fold of the hologram lasts 0.42 s (`unproject`), plus a margin */
const CLOSE_MS = 600

/**
 * D05 / F38 / D15: the services terminal, a hologram projected over the city. It holds the catalogue
 * (categories, search, every service) and each service's sheet (availability, contact, procedures),
 * with its own breadcrumb. A native modal dialog: focus stays inside, Escape closes, focus goes back.
 */
export function ServiceTerminal({ target, onClose }: { target: TerminalTarget; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const [view, setView] = useState<View>({ category: target.category, service: target.service })
  const [navigated, setNavigated] = useState(false)
  const [closing, setClosing] = useState(false)
  const reduced = useReducedMotion()
  const titleId = useId()
  useBodyClass('is-locked')

  // the button that opened the terminal gets the focus back (read before the dialog takes it)
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    holdSmoothScroll(true)
    return () => {
      holdSmoothScroll(false)
      opener?.focus({ preventScroll: true })
    }
  }, [opener])

  // a move inside the terminal starts at the top of the new view, with its title read out
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    bodyRef.current?.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [view])

  // the fold ends on its own animation; the timer only covers a starved frame rate (heavy scene, hidden tab)
  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(onClose, CLOSE_MS)
    return () => clearTimeout(timer)
  }, [closing, onClose])

  const go = (next: View) => {
    moved.current = true
    setNavigated(true)
    setView(next)
  }
  const close = () => (reduced ? onClose() : setClosing(true))
  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (closing && event.target === event.currentTarget) onClose()
  }
  // the dialog fills the screen: a click that reaches it directly landed outside the hologram
  const onBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close()
  }

  const accent = view.service ? availabilityView(view.service.availability).status : 'AVAILABLE'
  const style = { '--ox': `${target.origin.x}px`, '--oy': `${target.origin.y}px` } as CSSProperties

  return createPortal(
    <dialog
      ref={dialogRef}
      className={[styles.dialog, closing && styles.closing].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={onBackdrop}
    >
      <div className={styles.projector} style={style} data-status={accent} data-navigated={navigated || undefined} onAnimationEnd={onAnimationEnd}>
        <span className={`${styles.bracket} ${styles.bracketTop}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketBottom}`} aria-hidden="true" />
        <div className={styles.frame}>
          <span className={styles.hexfield} aria-hidden="true" />
          <span className={styles.beam} aria-hidden="true" />
          <span className={`${styles.cut} ${styles.cutTop}`} aria-hidden="true" />
          <span className={`${styles.cut} ${styles.cutBottom}`} aria-hidden="true" />

          <header className={styles.bar}>
            <span className={styles.signal}>
              <NovaMark size={16} />
              Terminal des services
              <i aria-hidden="true" />
            </span>
            <Crumbs view={view} onGo={go} />
            <button type="button" className={styles.close} onClick={close} aria-label="Fermer le terminal">
              <Icon name="close" />
            </button>
          </header>

          <div ref={bodyRef} className={styles.body} data-lenis-prevent>
            {view.service ? (
              <ServiceSheet
                key={view.service.slug}
                preview={view.service}
                titleId={titleId}
                headingRef={headingRef}
                onCategory={(category) => go({ category, service: null })}
                onService={(service) => go({ category: view.category, service })}
              />
            ) : (
              <Catalogue
                category={view.category}
                titleId={titleId}
                headingRef={headingRef}
                onCategory={(category) => go({ category, service: null })}
                onService={(service) => go({ category: view.category, service })}
              />
            )}
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}

/* ─── breadcrumb (D15) ──────────────────────────────────────────────────── */

function Crumbs({ view, onGo }: { view: View; onGo: (view: View) => void }) {
  const categories = useServiceCategories()
  const category = view.service ? view.service.category : (categories.data?.find((c) => c.slug === view.category) ?? null)
  return (
    <nav className={styles.crumbs} aria-label="Fil d'Ariane du catalogue">
      <ol>
        <li>
          {view.service || category ? (
            <button type="button" onClick={() => onGo({ category: null, service: null })}>
              Services
            </button>
          ) : (
            <span aria-current="page">Services</span>
          )}
        </li>
        {category && (
          <li>
            {view.service ? (
              <button type="button" onClick={() => onGo({ category: category.slug, service: null })}>
                {category.name}
              </button>
            ) : (
              <span aria-current="page">{category.name}</span>
            )}
          </li>
        )}
        {view.service && (
          <li>
            <span aria-current="page">{view.service.name}</span>
          </li>
        )}
      </ol>
    </nav>
  )
}

/* ─── catalogue (D05, F32) ──────────────────────────────────────────────── */

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

interface ViewProps {
  titleId: string
  headingRef: RefObject<HTMLHeadingElement | null>
  onCategory: (slug: string | null) => void
  onService: (service: CityService) => void
}

function Catalogue({ category, titleId, headingRef, onCategory, onService }: ViewProps & { category: string | null }) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 250)
  const categories = useServiceCategories()
  const services = useCatalogue({ category, q, limit: 100 })
  const active = categories.data?.find((c) => c.slug === category)
  const count = services.data ? `${plural(services.data.meta.total, 'service', 'services')}${q ? ` pour « ${q} »` : ''}` : 'Recherche en cours…'

  return (
    <div className={styles.catalogue}>
      <aside className={styles.rail} aria-label="Catégories">
        <p className={styles.kicker}>Catégories</p>
        <ul>
          <li>
            <button type="button" aria-pressed={category === null} onClick={() => onCategory(null)}>
              <ServiceGlyph name="grid" size={18} />
              <span>Tous les services</span>
            </button>
          </li>
          {categories.data?.map((c) => (
            <li key={c.id}>
              <button type="button" aria-pressed={category === c.slug} onClick={() => onCategory(c.slug)}>
                <ServiceGlyph name={c.icon} size={18} />
                <span>{c.name}</span>
                {c._count && <small>{c._count.services}</small>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className={styles.results}>
        <header className={styles.resultsHead}>
          <p className={styles.kicker}>{active ? 'Catégorie' : 'Catalogue de Terra Nova'}</p>
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
            {active?.name ?? 'Tous les services'}
          </h2>
          {active?.description && <p className={styles.lead}>{active.description}</p>}
          <label className={styles.search}>
            <Icon name="search" />
            <span className={styles.srOnly}>Rechercher un service</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Médecin, papiers, bus, déchets…" autoComplete="off" />
          </label>
          <p className={styles.count} aria-live="polite">
            {count}
          </p>
        </header>

        {services.isError && !services.data ? (
          <p className={styles.error} role="alert">
            <Icon name="alert" /> {messageFor(services.error)}
          </p>
        ) : !services.data ? (
          <div className={styles.cards} aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={styles.ghostCard} />
            ))}
          </div>
        ) : (
          <>
            {services.isError &&
              (isNetworkFailure(services.error) ? (
                <p className={styles.muted}>Dernier catalogue connu. Il se mettra à jour au retour du réseau.</p>
              ) : (
                <p className={styles.error} role="alert">
                  <Icon name="alert" /> {messageFor(services.error)}
                </p>
              ))}
            {services.data.data.length === 0 ? (
              <div className={styles.none}>
                <p>Aucun service ne correspond{q ? ` à « ${q} »` : ' à cette catégorie'}.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    onCategory(null)
                  }}
                >
                  Voir tous les services
                </button>
              </div>
            ) : (
              <ul key={services.data.data.map((s) => s.id).join('-')} className={[styles.cards, services.isPlaceholderData && styles.stale].filter(Boolean).join(' ')}>
                {services.data.data.map((service, i) => (
                  <li key={service.id} style={{ '--i': i } as CSSProperties}>
                    <ServiceCard service={service} onOpen={() => onService(service)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function ServiceCard({ service, onOpen }: { service: CityService; onOpen: () => void }) {
  const view = availabilityView(service.availability)
  const procedures = service._count?.procedures ?? 0
  return (
    <button type="button" className={styles.card} data-status={view.status} onClick={onOpen}>
      <span className={styles.cardHead}>
        <span className={styles.cardGlyph}>
          <ServiceGlyph name={service.icon} size={24} />
        </span>
        {service.is_featured && (
          <span className={styles.featured}>
            <ServiceGlyph name="star" size={12} stroke={2} />À la une
          </span>
        )}
      </span>
      <strong>{service.name}</strong>
      <small className={styles.cardSummary}>{service.summary}</small>
      <span className={styles.cardFoot}>
        <span className={styles.state}>
          <i aria-hidden="true" />
          {view.label}
        </span>
        {procedures > 0 && <span>{plural(procedures, 'démarche', 'démarches')}</span>}
      </span>
    </button>
  )
}

/* ─── a service's sheet (D05, F38) ──────────────────────────────────────── */

type ProcedureItem = Pick<Procedure, 'id' | 'title' | 'description' | 'estimated_days'> & { required_documents?: unknown }

/** `required_documents` is a JSON list or free text, one document per line */
function documentsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((line) => line.trim()).filter(Boolean)
  return []
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function ServiceSheet({ preview, titleId, headingRef, onCategory, onService }: ViewProps & { preview: CityService }) {
  const detail = useService(preview.slug)
  const service: CityService | ServiceDetail = detail.data ?? preview
  const procedures = useProcedures(service.id)
  const related = useCatalogue({ category: service.category?.slug ?? null, limit: 50 })
  const name = useTypewriter(service.name)
  const view = availabilityView(service.availability)
  const { current, upcoming } = service.availability

  const steps: ProcedureItem[] = procedures.data ?? (detail.data ? detail.data.procedures : [])
  const others = (related.data?.data ?? []).filter((s) => s.id !== service.id).slice(0, 4)

  const cells: { icon: IconName; label: string; value: string; href?: string; external?: boolean }[] = []
  if (service.opening_hours) cells.push({ icon: 'clock', label: 'Horaires', value: service.opening_hours })
  if (service.address) cells.push({ icon: 'pin', label: 'Adresse', value: service.address })
  if (service.contact_phone) cells.push({ icon: 'phone', label: 'Téléphone', value: service.contact_phone, href: telHref(service.contact_phone) })
  if (service.contact_email) cells.push({ icon: 'mail', label: 'E-mail', value: service.contact_email, href: `mailto:${service.contact_email}` })
  if (service.external_url) cells.push({ icon: 'external', label: 'Site web', value: service.external_url.replace(/^https?:\/\//, ''), href: service.external_url, external: true })

  return (
    <article className={styles.sheet}>
      <header className={styles.hero}>
        <GlyphCore icon={service.icon} />
        <div className={styles.heroText}>
          <p className={styles.kicker}>
            <Plate>SRV-{String(service.id).padStart(3, '0')}</Plate>
            {service.category && (
              <button type="button" className={styles.categoryLink} onClick={() => onCategory(service.category!.slug)}>
                {service.category.name}
              </button>
            )}
          </p>
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className={styles.heroTitle} aria-label={service.name}>
            <span aria-hidden="true">{name}</span>
            <i className={styles.caret} aria-hidden="true" />
          </h2>
          <p className={styles.summary}>{service.summary}</p>
          <p className={styles.stateLine}>
            <span className={styles.state}>
              <i aria-hidden="true" />
              {view.label}
            </span>
            {view.detail && <span>{view.detail}</span>}
          </p>
        </div>
      </header>

      {current && (
        <section className={styles.notice} aria-labelledby={`${titleId}-notice`}>
          <Icon name="alert" size={22} />
          <div>
            <h3 id={`${titleId}-notice`}>{view.status === 'UNAVAILABLE' ? 'Service indisponible' : 'Service perturbé'}</h3>
            <p>{current.reason}</p>
            <p>
              <strong>Retour prévu :</strong> {service.availability.back_at ? formatMoment(service.availability.back_at) : "jusqu'à nouvel ordre"}
            </p>
            {current.alternative && (
              <p>
                <strong>En attendant :</strong> {current.alternative}
              </p>
            )}
          </div>
        </section>
      )}

      {cells.length > 0 && (
        <dl className={styles.cells}>
          {cells.map((cell) => (
            <div key={cell.label} className={styles.cell}>
              <dt>
                <Icon name={cell.icon} size={14} />
                {cell.label}
              </dt>
              <dd>
                {cell.href ? (
                  <a href={cell.href} {...(cell.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    {cell.value}
                  </a>
                ) : (
                  cell.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <BookingBand serviceId={service.id} slug={service.slug} unavailable={view.status === 'UNAVAILABLE'} />

      {service.description && (
        <section className={styles.block}>
          <h3>Présentation</h3>
          <p className={styles.description}>{service.description}</p>
        </section>
      )}

      <section className={styles.block}>
        <h3>
          Démarches en ligne
          {steps.length > 0 && <span className={styles.tally}>{steps.length}</span>}
        </h3>
        {procedures.isPending && steps.length === 0 ? (
          <span className={styles.ghostLine} aria-hidden="true" />
        ) : procedures.isError && steps.length === 0 ? (
          <p className={styles.muted}>Les démarches n’ont pas pu être chargées. Les horaires et les coordonnées ci-dessus restent valables.</p>
        ) : steps.length === 0 ? (
          <p className={styles.muted}>Ce service ne propose pas encore de démarche en ligne : contactez-le directement.</p>
        ) : (
          <>
            {view.status === 'UNAVAILABLE' && (
              <p className={styles.blocked}>
                <Icon name="alert" size={16} />
                Les démarches de ce service sont suspendues {service.availability.back_at ? `jusqu'au ${formatMoment(service.availability.back_at)}` : "jusqu'à nouvel ordre"}.
              </p>
            )}
            <ol className={styles.procedures}>
              {steps.map((step, i) => (
                <ProcedureRow key={step.id} step={step} index={i} />
              ))}
            </ol>
          </>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className={styles.block}>
          <h3>Interruptions prévues</h3>
          <ul className={styles.timeline}>
            {upcoming.map((u) => (
              <li key={u.id}>
                <p className={styles.when}>
                  {formatMoment(u.starts_at)}
                  {u.ends_at && <> → {formatMoment(u.ends_at)}</>}
                </p>
                <p>{u.reason}</p>
                {u.alternative && <p className={styles.muted}>En attendant : {u.alternative}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className={styles.block}>
          <h3>{service.category ? 'Dans la même catégorie' : 'Autres services'}</h3>
          <div className={styles.related}>
            {others.map((s) => (
              <button key={s.id} type="button" onClick={() => onService(s)}>
                <ServiceGlyph name={s.icon} size={18} />
                <span>{s.name}</span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

/** F39: when the service receives by appointment, its next free slot and the way to book it */
function BookingBand({ serviceId, slug, unavailable }: { serviceId: number; slug: string; unavailable: boolean }) {
  const slots = useSlots(serviceId)
  const next = slots.data?.[0]
  if (!next) return null
  return (
    <section className={styles.booking} aria-label="Rendez-vous">
      <span className={styles.bookingIcon} aria-hidden="true">
        <Icon name="calendar" size={22} />
      </span>
      <div>
        <p className={styles.bookingTitle}>Rendez-vous avec un agent</p>
        <p className={styles.muted}>
          Prochain créneau libre : {next.day_label} à {next.start_time} · {slots.data!.length} créneau{slots.data!.length > 1 ? 'x' : ''} sur 14 jours
        </p>
        {unavailable && <p className={styles.blocked}>Le service est interrompu : les créneaux pendant l’interruption seront refusés.</p>}
      </div>
      <Link className={styles.bookingButton} to={`/ville/rendez-vous/nouveau?service=${slug}`}>
        Prendre rendez-vous
        <Icon name="chevron" size={16} />
      </Link>
    </section>
  )
}

function ProcedureRow({ step, index }: { step: ProcedureItem; index: number }) {
  const documents = documentsOf(step.required_documents)
  const delay = formatDelay(step.estimated_days)
  return (
    <li>
      <details className={styles.procedure}>
        <summary>
          <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
          <span className={styles.procedureTitle}>
            <strong>{step.title}</strong>
            {delay && <small>Délai {delay}</small>}
          </span>
          <Icon name="chevron" size={18} />
        </summary>
        <div className={styles.procedureBody}>
          {step.description && <p>{step.description}</p>}
          {documents.length > 0 && (
            <>
              <h4>Pièces à fournir</h4>
              <ul className={styles.documents}>
                {documents.map((document) => (
                  <li key={document}>
                    <Icon name="file" size={15} />
                    {document}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!step.description && documents.length === 0 && <p className={styles.muted}>Aucune pièce particulière n'est demandée.</p>}
        </div>
      </details>
    </li>
  )
}

/** The service's pictogram in its reactor: rings turning at different speeds around a breathing hexagon */
function GlyphCore({ icon }: { icon: string | null }) {
  return (
    <div className={styles.core} aria-hidden="true">
      <svg className={styles.ringOuter} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="57" />
      </svg>
      <svg className={styles.ringArc} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="57" />
      </svg>
      <svg className={styles.ringInner} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="47" />
      </svg>
      <span className={styles.orbit}>
        <i />
      </span>
      <span className={styles.coreHex}>
        <ServiceGlyph name={icon} size={34} stroke={1.4} />
      </span>
    </div>
  )
}
