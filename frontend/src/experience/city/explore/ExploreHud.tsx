import { useEffect, useRef, type PointerEvent } from 'react'
import { director } from '../../director/director'
import { useDirectorStore } from '../../director/directorStore'
import { frameBus } from '../../director/frameState'
import { novaScenes } from '../../nova/behavior/scenes'
import { defineMessages, useMessages } from '../../../i18n'
import { Icon } from '../../../ui/Icon'
import { POIS, poiById, poiText, usePoiTexts } from '../cityConfig'
import { relief } from '../layout/relief'
import { exploreActions } from './exploreActions'
import { useExploreInput } from './useExploreInput'
import styles from './ExploreHud.module.css'

const messages = defineMessages(
  {
    here: 'Vous êtes ici',
    flyToOther: "S'envoler vers un autre site",
    flyTo: "S'envoler vers",
    hintPhone: 'Joystick pour marcher · glissez pour regarder',
    hintDesktop: 'ZQSD / WASD pour marcher · glissez pour regarder · Échap pour le survol',
    resume: 'Reprendre le survol',
    flyingTo: (destination: string) => `En vol vers ${destination}`,
    heading: 'Cap',
    altitude: 'Alt',
    speed: 'Vit',
    landing: 'Atterrissage',
  },
  {
    here: 'You are here',
    flyToOther: 'Fly to another site',
    flyTo: 'Fly to',
    hintPhone: 'Joystick to walk · drag to look around',
    hintDesktop: 'WASD / ZQSD to walk · drag to look around · Esc for the flyover',
    resume: 'Resume the flyover',
    flyingTo: (destination) => `Flying to ${destination}`,
    heading: 'Heading',
    altitude: 'Alt',
    speed: 'Spd',
    landing: 'Landing',
  },
)

interface ExploreHudProps {
  exploring: boolean
  ready: boolean
  phone: boolean
}

/**
 * The explore mode's interface: in the air a heads-up display (heading, altitude, speed, time to landing);
 * on a site its name, the other sites to fly to, the controls and the way back.
 */
export function ExploreHud({ exploring, ready, phone }: ExploreHudProps) {
  const { site, destination, flight, leaving } = useDirectorStore((s) => s.explore)
  const onGround = exploring && !leaving && site !== null && flight === null
  const { beginLook, setStick } = useExploreInput(exploring && !leaving)
  const pad = useRef<HTMLDivElement>(null)
  const m = useMessages(messages)
  const texts = usePoiTexts()

  // Nova introduces each site as it lands on it
  const lastFlight = useRef(flight)
  useEffect(() => {
    if (flight === 'landing' && lastFlight.current !== 'landing' && destination) {
      const poi = poiText(destination)
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

  if (!ready || !exploring) return null

  const here = site ? poiById(site) : null
  const airborne = flight !== null && flight !== 'landing' && !leaving && destination !== null

  return (
    <div className={styles.hud}>
      {onGround && <div className={styles.look} onPointerDown={beginLook} aria-hidden="true" />}

      {airborne && <FlightDisplay destination={texts[destination].name} />}

      {onGround && here && (
        <>
          <section className={styles.site} aria-live="polite">
            <p className={styles.siteKicker}>
              <Icon name={here.icon} size={14} />
              <span>{m.here}</span>
            </p>
            <h2 className={styles.siteName}>{texts[here.id].name}</h2>
            <p className={styles.siteBlurb}>{texts[here.id].blurb}</p>
          </section>

          <nav className={styles.poiBar} aria-label={m.flyToOther}>
            <span className={styles.poiLabel}>{m.flyTo}</span>
            {POIS.filter((poi) => poi.id !== site).map((poi) => (
              <button key={poi.id} type="button" className={styles.poiBtn} onClick={() => exploreActions.flyTo(poi.id)}>
                <Icon name={poi.icon} size={16} />
                <span>{texts[poi.id].name}</span>
              </button>
            ))}
          </nav>

          <p className={styles.hint}>{phone ? m.hintPhone : m.hintDesktop}</p>

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
          {m.resume}
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
  const m = useMessages(messages)

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
    <div className={styles.flight} role="status" aria-label={m.flyingTo(destination)}>
      <p className={styles.heading}>
        <span>{m.heading}</span>
        <strong>{destination}</strong>
      </p>
      <div className={styles.reticle} aria-hidden="true">
        <i />
        <i />
      </div>
      <p className={`${styles.gauge} ${styles.gaugeLeft}`} aria-hidden="true">
        <span>{m.altitude}</span>
        <strong ref={altitude}>000</strong>
        <em>m</em>
      </p>
      <p className={`${styles.gauge} ${styles.gaugeRight}`} aria-hidden="true">
        <span>{m.speed}</span>
        <strong ref={speed}>000</strong>
        <em>km/h</em>
      </p>
      <div className={styles.arrival} aria-hidden="true">
        <span>{m.landing}</span>
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
