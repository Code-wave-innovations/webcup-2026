import { useEffect, useState } from 'react'
import { useReducedMotion } from '../hooks/useMediaQuery'

const STEP_MS = 34
const CHARS_PER_STEP = 2

/** Reveals `text` two characters at a time, like a radio transmission (instantly with reduced motion). */
export function useTypewriter(text: string): string {
  const reduced = useReducedMotion()
  const [progress, setProgress] = useState({ text, count: 0 })
  // a new text starts from the beginning without an extra render
  const count = progress.text === text ? progress.count : 0

  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = Math.min((p.text === text ? p.count : 0) + CHARS_PER_STEP, text.length)
        if (next >= text.length) clearInterval(timer)
        return { text, count: next }
      })
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [text, reduced])

  return reduced ? text : text.slice(0, count)
}
