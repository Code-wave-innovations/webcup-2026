import type { Transition, Variants } from 'motion/react'

export const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

/** Panels arrive one after another. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
}

export const rise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: EASE_OUT } },
}

/** Route change: a holographic wipe (clip-path) with a short blur. */
export const pageTransition: Variants = {
  initial: { opacity: 0, clipPath: 'inset(0 0 100% 0)', filter: 'blur(6px)' },
  enter: {
    opacity: 1,
    clipPath: 'inset(0 0 0% 0)',
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE_OUT },
  },
  exit: { opacity: 0, filter: 'blur(4px)', transition: { duration: 0.18 } },
}

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 34 }
