import { useEffect, useRef } from 'react'
import { frameBus, frameState } from '../director/frameState'
import { speechProgress } from './behavior/novaBrain'
import { novaNow, useNovaStore } from './behavior/novaStore'
import styles from './NovaSpeechBubble.module.css'

const TAIL_X = 26
const GAP = 14
const MARGIN = 12

/**
 * What Nova says, typed in a bubble above its head. The letters appear on the same clock as the mouth
 * moves; screen readers get the whole sentence at once.
 */
export function NovaSpeechBubble() {
  const speech = useNovaStore((s) => s.brain.speech)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        const bubble = bubbleRef.current
        const text = textRef.current
        if (!bubble || !text) return
        const current = useNovaStore.getState().brain.speech
        const progress = speechProgress(current, novaNow())
        const head = frameState.nova.head
        const visible = progress.visible && head.visible
        bubble.dataset.visible = String(visible)
        bubble.dataset.typing = String(progress.talking)
        if (!visible || !current) return
        const shown = current.text.slice(0, progress.shown)
        if (text.textContent !== shown) text.textContent = shown
        // the bubble opens to the left of the head: Nova stands beside the interface, on its left in the
        // cockpit (the hologram) and in the right corner of the city
        const x = Math.min(Math.max(MARGIN, head.x + TAIL_X - bubble.offsetWidth), window.innerWidth - bubble.offsetWidth - MARGIN)
        const y = Math.max(MARGIN, head.y - bubble.offsetHeight - GAP)
        bubble.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
      }),
    [],
  )

  return (
    <>
      <div ref={bubbleRef} className={styles.bubble} data-visible="false" aria-hidden="true">
        <b>NOVA</b>
        <p ref={textRef} />
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {speech ? `Nova : ${speech.text}` : ''}
      </p>
    </>
  )
}
