import { useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { messageFor } from '../../api/errors'
import { useCatalogue, useServiceCategories } from '../../api/services'
import type { CityService } from '../../api/types'
import { Icon } from '../../ui/Icon'
import { availabilityView, plural } from './availability'
import { ServiceGlyph } from './ServiceGlyph'
import { ServiceTerminal, type TerminalTarget } from './ServiceTerminal'
import styles from './Services.module.css'

/** Tiles on the flyover panel; the rest of the catalogue opens in the terminal. */
const SHOWN = 6

/** Where the hologram is projected from: the click, or the middle of the button from the keyboard. */
function originOf(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  const keyboard = event.detail === 0
  const x = keyboard ? rect.left + rect.width / 2 : event.clientX
  const y = keyboard ? rect.top + rect.height / 2 : event.clientY
  return { x: x - window.innerWidth / 2, y: y - window.innerHeight / 2 }
}

/** The light that follows the cursor across a tile */
function trackGlow(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

/**
 * D07 / F28 / F38: the "Services" district of the flyover. The services put forward by the admins come
 * first, each with its live availability; the hexagons filter by category, a tile opens its sheet.
 */
export function ServiceShowcase() {
  const [category, setCategory] = useState<string | null>(null)
  const [terminal, setTerminal] = useState<TerminalTarget | null>(null)
  const categories = useServiceCategories()
  const services = useCatalogue({ category, limit: SHOWN })
  const active = categories.data?.find((c) => c.slug === category)
  const total = services.data?.meta.total ?? 0

  const open = (target: Omit<TerminalTarget, 'origin'>) => (event: MouseEvent<HTMLElement>) => setTerminal({ ...target, origin: originOf(event) })

  return (
    <>
      <div className={styles.hexes} role="group" aria-label="Catégories de services">
        <HexChip label="À la une" glyph="star" pressed={category === null} onClick={() => setCategory(null)} />
        {categories.data?.map((c) => (
          <HexChip key={c.id} label={c.name} glyph={c.icon} pressed={category === c.slug} onClick={() => setCategory(c.slug)} />
        ))}
      </div>

      <p className={styles.caption} aria-live="polite">
        <strong>{active?.name ?? 'À la une'}</strong>
        <span>{active ? plural(total, 'service', 'services') : 'les services prioritaires de la ville'}</span>
      </p>

      {services.isError ? (
        <div className={styles.offline} role="alert">
          <Icon name="alert" />
          <span>
            <strong>Le dôme central ne répond pas</strong>
            <small>{messageFor(services.error)}</small>
          </span>
          <button type="button" onClick={() => void services.refetch()}>
            Réessayer
          </button>
        </div>
      ) : !services.data ? (
        <div className={styles.grid} aria-busy="true" aria-label="Chargement des services">
          {Array.from({ length: SHOWN }, (_, i) => (
            <span key={i} className={styles.ghost} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      ) : services.data.data.length === 0 ? (
        <p className={styles.empty}>Aucun service dans cette catégorie pour l'instant.</p>
      ) : (
        // a new set of tiles plays its entrance; the refresh of the same set does not
        <ul
          key={services.data.data.map((s) => s.id).join('-')}
          className={[styles.grid, services.isPlaceholderData && styles.stale].filter(Boolean).join(' ')}
        >
          {services.data.data.map((service, i) => (
            <li key={service.id} style={{ '--i': i } as CSSProperties}>
              <ServiceTile service={service} onClick={open({ category, service })} />
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.explore} onClick={open({ category, service: null })} disabled={!services.data}>
        <span>
          Explorer le catalogue
          {services.data && <small>{active ? `${plural(total, 'service', 'services')} · ${active.name}` : plural(total, 'service', 'services')}</small>}
        </span>
        <Icon name="chevron" />
      </button>

      {terminal && <ServiceTerminal target={terminal} onClose={() => setTerminal(null)} />}
    </>
  )
}

/**
 * D07: the main services, reachable from the arrival without scrolling. Same request as the district's
 * tiles (the first ones of the catalogue order), so both read one cache.
 */
export function QuickServices() {
  const [terminal, setTerminal] = useState<TerminalTarget | null>(null)
  const services = useCatalogue({ category: null, limit: SHOWN })
  const quick = services.data?.data.slice(0, 4) ?? []
  if (quick.length === 0) return null

  return (
    <div className={styles.quick}>
      <p className={styles.quickLabel} id="quick-services">
        Accès rapide aux services
      </p>
      <ul aria-labelledby="quick-services">
        {quick.map((service, i) => {
          const view = availabilityView(service.availability)
          return (
            <li key={service.id} style={{ '--i': i } as CSSProperties}>
              <button
                type="button"
                className={styles.quickItem}
                data-status={view.status}
                onClick={(event) => setTerminal({ category: null, service, origin: originOf(event) })}
                onPointerMove={trackGlow}
              >
                <ServiceGlyph name={service.icon} size={18} />
                <span>{service.name}</span>
                <i aria-hidden="true" />
                {/* the state is spelt out, never only told by the dot's colour (F38) */}
                {view.status === 'AVAILABLE' ? <span className={styles.srOnly}>, {view.label}</span> : <small>{view.label}</small>}
              </button>
            </li>
          )
        })}
      </ul>
      {terminal && <ServiceTerminal target={terminal} onClose={() => setTerminal(null)} />}
    </div>
  )
}

function HexChip({ label, glyph, pressed, onClick }: { label: string; glyph: string | null; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.hexChip} aria-pressed={pressed} aria-label={label} title={label} onClick={onClick}>
      <ServiceGlyph name={glyph} size={18} />
    </button>
  )
}

function ServiceTile({ service, onClick }: { service: CityService; onClick: (event: MouseEvent<HTMLElement>) => void }) {
  const view = availabilityView(service.availability)
  return (
    <button type="button" className={styles.tile} data-status={view.status} onClick={onClick} onPointerMove={trackGlow}>
      <span className={styles.tileGlyph}>
        <ServiceGlyph name={service.icon} />
      </span>
      <span className={styles.tileBody}>
        <strong>{service.name}</strong>
        <span className={styles.status}>
          <i aria-hidden="true" />
          {view.label}
          {view.status !== 'AVAILABLE' && view.detail && <span className={styles.statusDetail}> {view.detail}</span>}
        </span>
      </span>
      {service.is_featured && (
        <span className={styles.featured}>
          <ServiceGlyph name="star" size={11} stroke={2} />
          <span className={styles.srOnly}>, service mis en avant</span>
        </span>
      )}
    </button>
  )
}
