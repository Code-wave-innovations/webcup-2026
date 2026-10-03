import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { scrollPageTo } from '../../app/smoothScroll'
import { director } from '../../experience/director/director'
import { matchesQuery, PHONE_QUERY, useReducedMotion } from '../../hooks/useMediaQuery'
import { smoothstep } from '../../lib/math'
import { computeScrollState } from './computeScrollState'

/** A measured section of the page, with the elements the scroll animates. */
export interface LiveSection {
  element: HTMLElement
  top: number
  height: number
  column: HTMLElement
  panel: HTMLElement | null
  scrollHint: HTMLElement | null
  reveal: number
}

export interface LiveScroll {
  sections: LiveSection[]
  active: number
}

/**
 * Drives the flyover from the page scroll: camera progress, panels' reveal (`--reveal` on each section)
 * and the active section. Runs on scroll events without React renders, except when the active section changes.
 */
export function useCityScroll(root: RefObject<HTMLElement | null>, enabled: boolean) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const live = useRef<LiveScroll>({ sections: [], active: -1 })

  useEffect(() => {
    const container = root.current
    if (!enabled || !container) return
    let frame = 0

    const update = () => {
      const { sections } = live.current
      if (!sections.length) return
      const phone = matchesQuery(PHONE_QUERY)
      const screen = window.innerHeight
      const y = window.scrollY
      const metrics = sections.map((s) => ({ top: s.top, height: s.height, columnTop: phone ? s.column.getBoundingClientRect().top : 0 }))
      const state = computeScrollState(y, screen, metrics, { phone, reduced })
      state.reveals.forEach((reveal, i) => {
        const section = sections[i]
        if (Math.abs(reveal - section.reveal) <= 0.004) return
        section.reveal = reveal
        section.element.style.setProperty('--reveal', reveal.toFixed(3))
        section.column.style.visibility = reveal < 0.02 ? 'hidden' : 'visible'
      })
      sections[0].scrollHint?.style.setProperty('--reveal', (state.reveals[0] * (1 - smoothstep(0, screen * 0.25, y))).toFixed(3))
      director.setScroll(state.u)
      director.section = state.active
      if (state.active !== live.current.active) {
        live.current.active = state.active
        setActive(state.active)
      }
    }

    const measure = () => {
      document.documentElement.style.setProperty('--screen-h', `${window.innerHeight}px`)
      live.current.sections = [...container.querySelectorAll<HTMLElement>('[data-city-section]')].map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          element,
          top: rect.top + window.scrollY,
          height: rect.height,
          column: element.querySelector<HTMLElement>('[data-column]') ?? element,
          panel: element.querySelector<HTMLElement>('[data-panel]'),
          scrollHint: element.querySelector<HTMLElement>('[data-scroll-hint]'),
          reveal: -1,
        }
      })
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    measure()
    // phone sections grow with their content (a report turning into its tracking): measure again
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', measure)
    }
  }, [root, enabled, reduced])

  /** Smooth scroll so that the section's panel sits where its camera pose frames it. */
  const scrollTo = useCallback(
    (id: string) => {
      const { sections } = live.current
      const section = sections.find((s) => s.element.id === id)
      if (!section) return false
      const y = matchesQuery(PHONE_QUERY)
        ? section.column.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.42
        : section.top + window.innerHeight * (section === sections[0] ? 0 : 0.2)
      scrollPageTo(Math.max(0, y), reduced)
      return true
    },
    [reduced],
  )

  return { active, scrollTo, live }
}
