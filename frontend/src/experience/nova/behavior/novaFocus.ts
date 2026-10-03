import { novaSignals } from './novaStore'

const LOOK_SELECTOR = '[data-nova-look]'
let tracking = false

function aim(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest<HTMLElement>(LOOK_SELECTOR) : null
  if (!element) return
  const rect = element.getBoundingClientRect()
  novaSignals.focus = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function release(event: Event & { relatedTarget: EventTarget | null }) {
  const leaving = event.target instanceof Element ? event.target.closest(LOOK_SELECTOR) : null
  const entering = event.relatedTarget instanceof Element ? event.relatedTarget.closest(LOOK_SELECTOR) : null
  if (leaving && leaving !== entering) novaSignals.focus = null
}

/**
 * Starts (once) watching the controls marked `data-nova-look`: while one is hovered or focused,
 * Nova looks at it instead of the cursor. The interface only marks its calls to action.
 */
export function trackNovaFocus(): void {
  if (tracking || typeof document === 'undefined') return
  tracking = true
  document.addEventListener('pointerover', (event) => aim(event.target), { passive: true })
  document.addEventListener('pointerout', release, { passive: true })
  document.addEventListener('focusin', (event) => aim(event.target))
  document.addEventListener('focusout', release)
}
