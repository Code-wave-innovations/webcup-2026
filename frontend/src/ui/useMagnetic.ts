import { useCallback } from 'react'
import { matchesQuery, useReducedMotion } from '../hooks/useMediaQuery'
import { clamp } from '../lib/math'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

/**
 * Ref callback that makes an element lean towards the cursor hovering it (a few pixels at most),
 * through the CSS `translate` property so it composes with the element's own transforms.
 * Off for touch screens and reduced motion.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.22, max = 8) {
  const reduced = useReducedMotion()
  return useCallback(
    (element: T | null) => {
      if (!element || reduced || !matchesQuery(FINE_POINTER_QUERY)) return
      let shift = { x: 0, y: 0 }
      const move = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect()
        // centre of the element at rest (the rect includes the current shift)
        const cx = rect.left - shift.x + rect.width / 2
        const cy = rect.top - shift.y + rect.height / 2
        shift = { x: clamp((event.clientX - cx) * strength, -max, max), y: clamp((event.clientY - cy) * strength, -max, max) }
        element.style.translate = `${shift.x.toFixed(1)}px ${shift.y.toFixed(1)}px`
      }
      const leave = () => {
        shift = { x: 0, y: 0 }
        element.style.translate = ''
      }
      element.addEventListener('pointermove', move)
      element.addEventListener('pointerleave', leave)
      return () => {
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerleave', leave)
        leave()
      }
    },
    [reduced, strength, max],
  )
}
