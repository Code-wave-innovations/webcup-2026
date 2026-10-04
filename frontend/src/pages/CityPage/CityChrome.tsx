import { useEffect, useRef, type RefObject } from 'react'
import { switchScene } from '../../a11y/sceneMode'
import { frameBus, frameState } from '../../experience/director/frameState'
import { defineMessages, useMessages } from '../../i18n'
import { Icon, NovaMark } from '../../ui/Icon'
import { LanguageSwitch } from '../../ui/LanguageSwitch'
import { CitizenNav } from '../Console/CitizenNav'
import { CITY_SECTIONS, useCitySectionLabels } from './citySections'
import type { LiveScroll } from './useCityScroll'
import styles from './CityChrome.module.css'

const messages = defineMessages(
  {
    sections: 'Rubriques',
    resumeFlyover: 'Reprendre le survol',
    exploreCity: 'Explorer la ville',
    resume: 'Reprendre',
    explore: 'Explorer',
    quit: "Quitter la ville et revenir au contrôle d'accès",
    rail: 'Étapes du survol',
  },
  {
    sections: 'Sections',
    resumeFlyover: 'Resume the flyover',
    exploreCity: 'Explore the city',
    resume: 'Resume',
    explore: 'Explore',
    quit: 'Leave the city and go back to access control',
    rail: 'Flyover stops',
  },
)

const current = (active: boolean) => (active ? 'true' : undefined)

interface TopBarProps {
  active: number
  alert: boolean
  exploring: boolean
  onQuit: () => void
  onToggleExplore: () => void
}

export function TopBar({ active, alert, exploring, onQuit, onToggleExplore }: TopBarProps) {
  const m = useMessages(messages)
  const labels = useCitySectionLabels()
  return (
    <header className={`${styles.bar} ${styles.city}`} data-alert={alert} data-exploring={exploring}>
      <div className={styles.shell}>
        <div className={styles.brand}>
          <NovaMark />
          <span>NOVA</span>
        </div>
        <nav className={styles.links} aria-label={m.sections}>
          {CITY_SECTIONS.map((section, i) =>
            labels[section.id].nav ? (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={current(i === active)}
                aria-label={labels[section.id].full}
                title={labels[section.id].full}
              >
                {labels[section.id].nav}
              </a>
            ) : null,
          )}
          <i className={styles.sep} aria-hidden="true" />
          <CitizenNav variant="flyover" />
        </nav>
        <div className={styles.end}>
          <div className={styles.lang}>
            <LanguageSwitch />
          </div>
          {/* F96: the essentials without the 3D (reloads the page in the light version) */}
          <button type="button" className={styles.light} onClick={() => switchScene('light')}>
            <span>Version </span>légère
          </button>
          <button
            type="button"
            className={styles.explore}
            aria-label={exploring ? m.resumeFlyover : m.exploreCity}
            aria-pressed={exploring}
            onClick={onToggleExplore}
          >
            <Icon name="rocket" />
            <span>{exploring ? m.resume : m.explore}</span>
          </button>
          <button type="button" className={styles.round} aria-label={m.quit} onClick={onQuit}>
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function RouteRail({ active }: { active: number }) {
  const m = useMessages(messages)
  const labels = useCitySectionLabels()
  return (
    <nav className={styles.rail} aria-label={m.rail}>
      {CITY_SECTIONS.map((section, i) => (
        <a key={section.id} href={`#${section.id}`} aria-current={current(i === active)}>
          <span>{labels[section.id].rail}</span>
          <i />
        </a>
      ))}
    </nav>
  )
}

const LEAD = 34
const CLEARANCE = 40

/**
 * The line of light to the active district in the 3D city, redrawn every frame: from Nova's fingertip
 * while it presents the district, otherwise from the panel. Hidden when the district is off-screen or
 * tucked behind the panel.
 */
export function LinkLine({ live, phone }: { live: RefObject<LiveScroll>; phone: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const pulseRef = useRef<SVGCircleElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        const svg = svgRef.current
        if (!svg || !pathRef.current || !dotRef.current || !pulseRef.current) return
        const placeTarget = (point: { x: number; y: number }) => {
          for (const circle of [dotRef.current, pulseRef.current]) {
            circle?.setAttribute('cx', point.x.toFixed(1))
            circle?.setAttribute('cy', point.y.toFixed(1))
          }
        }
        const section = live.current.sections[live.current.active]
        const anchorId = CITY_SECTIONS[live.current.active]?.anchor
        const anchor = anchorId ? frameState.anchors[anchorId] : null
        if (phone || !section?.panel || !anchor?.visible || section.reveal <= 0.25) {
          svg.style.opacity = '0'
          return
        }
        const { finger, pointing } = frameState.nova
        if (finger.visible && pointing > 0.3) {
          // from Nova's fingertip, arching up to the landmark
          const cx = (finger.x + anchor.x) / 2
          const cy = Math.min(finger.y, anchor.y) - Math.abs(anchor.x - finger.x) * 0.18
          pathRef.current.setAttribute('d', `M${finger.x.toFixed(1)} ${finger.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}`)
          placeTarget(anchor)
          svg.style.opacity = Math.min(pointing, section.reveal).toFixed(2)
          return
        }
        const panel = section.panel.getBoundingClientRect()
        const towardsLeft = anchor.x < panel.left
        if ((towardsLeft && anchor.x > panel.left - CLEARANCE) || (!towardsLeft && anchor.x < panel.right + CLEARANCE)) {
          svg.style.opacity = '0'
          return
        }
        const x0 = towardsLeft ? panel.left : panel.right
        const y0 = panel.top + 26
        const x1 = x0 + (towardsLeft ? -LEAD : LEAD)
        pathRef.current.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y0.toFixed(1)} L${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}`)
        placeTarget(anchor)
        svg.style.opacity = section.reveal.toFixed(2)
      }),
    [live, phone],
  )

  return (
    <svg ref={svgRef} className={styles.line} aria-hidden="true">
      <path ref={pathRef} d="M0 0" />
      <circle ref={dotRef} r="7" cx="-99" cy="-99" />
      <circle ref={pulseRef} className={styles.pulse} r="7" cx="-99" cy="-99" />
    </svg>
  )
}
