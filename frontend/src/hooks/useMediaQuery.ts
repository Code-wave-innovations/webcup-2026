import { useSyncExternalStore } from 'react'
import { isLightScene } from '../a11y/sceneMode'

export const PHONE_QUERY = '(max-width: 860px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function matchesQuery(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Also true in the light version (F96), so GSAP and other JS motion stay off. The painted city animates in CSS. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY) || isLightScene
}
