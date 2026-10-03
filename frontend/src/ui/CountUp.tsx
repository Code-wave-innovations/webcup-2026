import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks/useMediaQuery'

/** Counts up (ease-out) from the last shown value to `value` once `start` is true. Writes the DOM directly. */
export function CountUp({ value, start, duration = 1300 }: { value: number; start: boolean; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!start || !element) return
    const from = shown.current
    if (reduced) {
      shown.current = value
      element.textContent = String(value)
      return
    }
    const t0 = performance.now()
    let frame = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration)
      const current = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)))
      shown.current = current
      element.textContent = String(current)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, start, duration, reduced])

  return <span ref={ref}>0</span>
}
