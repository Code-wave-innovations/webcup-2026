import { useEffect, useRef, type RefObject } from 'react'
import { frameBus, frameState } from '../../experience/director/frameState'
import { formatThousands } from '../../lib/format'
import styles from './AirlockPage.module.css'

/** Writes text only when it changes (these run every frame). */
function setText(element: HTMLElement | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value
}

const formatDistance = (km: number) => `${formatThousands(km)} km`

/** Distance, speed and sol, read from the cockpit instruments. */
export function Telemetry() {
  const distanceRef = useRef<HTMLElement>(null)
  const speedRef = useRef<HTMLElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        setText(distanceRef.current, formatDistance(frameState.cockpit.distanceKm))
        setText(speedRef.current, `${frameState.cockpit.speedKms.toFixed(2).replace('.', ',')} km/s`)
      }),
    [],
  )

  return (
    <ul className={styles.telemetry} aria-hidden="true">
      <li>
        <span>Distance</span>
        <b ref={distanceRef}>2 140 km</b>
      </li>
      <li>
        <span>Vitesse</span>
        <b ref={speedRef}>7,60 km/s</b>
      </li>
      <li>
        <span>Sol</span>
        <b>214</b>
      </li>
    </ul>
  )
}

/** Target reticle locked on Terra Nova's lights while the planet turns. */
export function Reticle({ hidden }: { hidden: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const distanceRef = useRef<HTMLElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        const root = rootRef.current
        if (!root) return
        const { city, distanceKm } = frameState.cockpit
        root.style.transform = `translate3d(${city.x.toFixed(1)}px,${city.y.toFixed(1)}px,0)`
        root.dataset.hidden = String(hidden || !city.visible)
        setText(distanceRef.current, formatDistance(distanceKm))
      }),
    [hidden],
  )

  return (
    <div ref={rootRef} className={styles.reticle} data-hidden="true" aria-hidden="true">
      <i />
      <span>
        <b>Terra Nova</b>
        <em ref={distanceRef}>2 140 km</em>
      </span>
    </div>
  )
}

/** Light cone from the dashboard emitter up to the bottom edge of the hologram. */
export function ProjectorBeam({ hologram }: { hologram: RefObject<HTMLElement | null> }) {
  const beamRef = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        const beam = beamRef.current
        const panel = hologram.current
        if (!beam || !panel) return
        const rect = panel.getBoundingClientRect()
        const { emitter } = frameState.cockpit
        const height = emitter.y - rect.bottom
        if (height <= 8) {
          beam.style.height = '0px'
          return
        }
        const footX = emitter.x - rect.left
        beam.style.cssText =
          `left:${rect.left.toFixed(1)}px;top:${rect.bottom.toFixed(1)}px;width:${rect.width.toFixed(1)}px;height:${height.toFixed(1)}px;` +
          `clip-path:polygon(7% 0,93% 0,${(footX + 7).toFixed(1)}px 100%,${(footX - 7).toFixed(1)}px 100%)`
      }),
    [hologram],
  )

  return <div ref={beamRef} className={styles.beam} aria-hidden="true" />
}
