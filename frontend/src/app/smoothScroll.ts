import gsap from 'gsap'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { useEffect } from 'react'
import { clamp } from '../lib/math'

let lenis: Lenis | null = null

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Inertial page scroll (Lenis) on GSAP's clock, so the flyover glides between districts. Lenis moves the
 * real window scroll, so everything that listens to `scroll` keeps working; touch scrolling stays native.
 */
export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const instance = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 })
    const tick = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    lenis = instance
    return () => {
      gsap.ticker.remove(tick)
      instance.destroy()
      if (lenis === instance) lenis = null
    }
  }, [enabled])
}

/** Freezes the page scroll (and so the flyover) while a dialog sits over the city. */
export function holdSmoothScroll(held: boolean): void {
  if (held) lenis?.stop()
  else lenis?.start()
}

/**
 * Scrolls the page to `y`: a 1.2 to 2.4 s glide (longer for farther districts) with the smooth scroll,
 * the browser's smooth scroll otherwise, a jump with reduced motion.
 */
export function scrollPageTo(y: number, reducedMotion: boolean): void {
  if (reducedMotion) {
    window.scrollTo({ top: y, behavior: 'auto' })
  } else if (lenis) {
    const screens = Math.abs(y - window.scrollY) / window.innerHeight
    lenis.scrollTo(y, { duration: clamp(1.2 + screens * 0.12, 1.2, 2.4), easing: easeInOutCubic })
  } else {
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}
