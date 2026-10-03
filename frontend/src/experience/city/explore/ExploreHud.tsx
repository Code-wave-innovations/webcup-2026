import { useEffect, useRef, type PointerEvent } from 'react'
import { director } from '../../director/director'
import { useDirectorStore } from '../../director/directorStore'
import { frameBus } from '../../director/frameState'
import { novaScenes } from '../../nova/behavior/scenes'
import { Icon } from '../../../ui/Icon'
import { POIS, poiById } from '../cityConfig'
import { relief } from '../layout/relief'
import { exploreActions } from './exploreActions'
import { useExploreInput } from './useExploreInput'
import styles from './ExploreHud.module.css'

interface ExploreHudProps {
  exploring: boolean
  ready: boolean
  phone: boolean
}

/**
 * The explore mode's interface: the button that takes off from the flyover; in the air a heads-up display (heading,
 * altitude, speed, time to landing); on a site its name, the other sites to fly to, the controls and the way back.
 */
export function ExploreHud({ exploring, ready, phone }: ExploreHudProps) {
  const { site, destination, flight, leaving } = useDirectorStore((s) => s.explore)
  const onGround = exploring && !leaving && site !== null && flight === null
  const { beginLook, setStick } = useExploreInput(exploring && !leaving)
  const pad = useRef<HTMLDivElement>(null)

  // Nova introduces each site as it lands on it
  const lastFlight = useRef(flight)
  useEffect(() => {
    if (flight === 'landing' && lastFlight.current !== 'landing' && destination) {
      const poi = poiById(destination)
      novaScenes.landAtPoi(poi.name, poi.blurb)
    }
    lastFlight.current = flight
  }, [flight, destination])

  const onStick = (event: PointerEvent<HTMLDivElement>) => {
    const ring = pad.current
    if (!ring) return
    const rect = ring.getBoundingClientRect()
    const x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.38)
    const y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.38)
    const len = Math.hypot(x, y) || 1
    const scale = Math.min(1, len)
    setStick((x / len) * scale, (-y / len) * scale)
  }

  if (!ready) return null

  if (!exploring) {
    return (
      <button type="button" className={styles.enter} onClick={exploreActions.enter}>
        <Icon name="rocket" />
        <span>Explorer la ville</span>
      </button>
    )
  }

  const here = site ? poiById(site) : null
  const airborne = flight !== null && flight !== 'landing' && !leaving && destination !== null

  return (
    <div className={styles.hud}>
      {onGround && <div className={styles.look} onPointerDown={beginLook} aria-hidden="true" />}

      {airborne && <FlightDisplay destination={poiById(destination).name} />}

      {onGround && here && (
        <>
          <section className={styles.site} aria-live="polite">
            <p className={styles.siteKicker}>
              <Icon name={here.icon} size={14} />
              <span>Vous êtes ici</span>
            </p>
            <h2 className={styles.siteName}>{here.name}</h2>
            <p className={styles.siteBlurb}>{here.blurb}</p>
          </section>

          <nav className={styles.poiBar} aria-label="S'envoler vers un autre site">
            <span className={styles.poiLabel}>S'envoler vers</span>
            {POIS.filter((poi) => poi.id !== site).map((poi) => (
              <button key={poi.id} type="button" className={styles.poiBtn} onClick={() => exploreActions.flyTo(poi.id)}>
                <Icon name={poi.icon} size={16} />
                <span>{poi.name}</span>
              </button>
            ))}
          </nav>

          <p className={styles.hint}>{phone ? 'Joystick pour marcher · glissez pour regarder' : 'ZQSD / WASD pour marcher · glissez pour regarder · Échap pour le survol'}</p>

          {phone && (
            <div
              ref={pad}
              className={styles.stick}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                onStick(event)
              }}
              onPointerMove={(event) => event.buttons && onStick(event)}
              onPointerUp={() => setStick(0, 0)}
              onPointerCancel={() => setStick(0, 0)}
            >
              <i />
            </div>
          )}
        </>
      )}

      {!leaving && (
        <button type="button" className={styles.leave} onClick={exploreActions.leave}>
          Reprendre le survol
        </button>
      )}
    </div>
  )
}

/** The heads-up display in flight; its numbers follow the film every frame without re-rendering React. */
function FlightDisplay({ destination }: { destination: string }) {
  const altitude = useRef<HTMLSpanElement>(null)
  const speed = useRef<HTMLSpanElement>(null)
  const eta = useRef<HTMLSpanElement>(null)
  const progress = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        const flight = director.flight
        if (!flight) return
        const { nova } = director.roam
        const ground = Math.max(relief(nova.x, nova.z), 0)
        if (altitude.current) altitude.current.textContent = String(Math.max(0, Math.round(nova.y - ground))).padStart(3, '0')
        if (speed.current) speed.current.textContent = String(Math.round(flight.sample.velocity.length() * 3.6)).padStart(3, '0')
        const left = Math.max(0, flight.plan.arrival - flight.t)
        if (eta.current) eta.current.textContent = left.toFixed(1)
        if (progress.current) progress.current.style.transform = `scaleX(${Math.min(1, flight.t / flight.plan.arrival)})`
      }),
    [],
  )

  return (
    <div className={styles.flight} role="status" aria-label={`En vol vers ${destination}`}>
      <p className={styles.heading}>
        <span>Cap</span>
        <strong>{destination}</strong>
      </p>
      <div className={styles.reticle} aria-hidden="true">
        <i />
        <i />
      </div>
      <p className={`${styles.gauge} ${styles.gaugeLeft}`} aria-hidden="true">
        <span>Alt</span>
        <strong ref={altitude}>000</strong>
        <em>m</em>
      </p>
      <p className={`${styles.gauge} ${styles.gaugeRight}`} aria-hidden="true">
        <span>Vit</span>
        <strong ref={speed}>000</strong>
        <em>km/h</em>
      </p>
      <div className={styles.arrival} aria-hidden="true">
        <span>Atterrissage</span>
        <strong>
          <span ref={eta}>0.0</span> s
        </strong>
        <div className={styles.track}>
          <div ref={progress} />
        </div>
      </div>
    </div>
  )
}
