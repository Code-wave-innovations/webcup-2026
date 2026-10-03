import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { RefObject } from 'react'

gsap.registerPlugin(useGSAP, SplitText)

/**
 * Arrival in the city: the headline rises line by line out of masks, then the greeting, lead and
 * actions follow. The split is undone at the end (the title reads as one sentence again).
 */
export function useHeroReveal(root: RefObject<HTMLElement | null>, play: boolean, reducedMotion: boolean) {
  useGSAP(
    (_, contextSafe) => {
      const headline = root.current?.querySelector<HTMLElement>('[data-reveal="headline"]')
      if (!play || reducedMotion || !headline || !contextSafe) return
      const rest = root.current?.querySelectorAll<HTMLElement>('[data-reveal="rest"]') ?? []
      let cancelled = false
      gsap.set(headline, { autoAlpha: 0 })
      gsap.set(rest, { autoAlpha: 0, y: 18 })

      // lines are measured once the display font is there; created in the context, so reverted with it
      const reveal = contextSafe(() => {
        if (cancelled) return
        const split = SplitText.create(headline, { type: 'lines', mask: 'lines' })
        gsap.set(headline, { autoAlpha: 1 })
        gsap
          .timeline({ delay: 0.35, onComplete: () => split.revert() })
          .from(split.lines, { yPercent: 115, duration: 0.95, stagger: 0.08, ease: 'expo.out' })
          .to(rest, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, '-=0.6')
      })
      document.fonts.ready.then(reveal)
      return () => {
        cancelled = true
      }
    },
    { dependencies: [play, reducedMotion], scope: root },
  )
}
