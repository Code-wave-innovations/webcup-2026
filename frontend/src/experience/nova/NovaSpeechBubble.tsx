import { useEffect, useRef } from 'react'
import { useDirectorStore } from '../director/directorStore'
import { frameBus, frameState } from '../director/frameState'
import { speechProgress } from './behavior/novaBrain'
import { novaNow, useNovaStore } from './behavior/novaStore'
import styles from './NovaSpeechBubble.module.css'

/** horizontal gap between the head and the right edge of the bubble (always to Nova's left) */
const SIDE_GAP = 18
/** how far below the brow the bubble sits (positive = lower) */
const DROP = 8
const MARGIN = 12

/**
 * What Nova says, typed in a bubble to the left of its head.
 */
export function NovaSpeechBubble() {
  const speech = useNovaStore((s) => s.brain.speech)
  const consoleOpen = useDirectorStore((s) => s.console)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)

  useEffect(
    () =>
      frameBus.subscribe(() => {
        const bubble = bubbleRef.current
        const text = textRef.current
        if (!bubble || !text) return
        // console pages (/ville/espace, contact…): city is only a backdrop — no flyover bubble
        if (useDirectorStore.getState().console) {
          bubble.dataset.visible = 'false'
          bubble.dataset.typing = 'false'
          return
        }
        const current = useNovaStore.getState().brain.speech
        const progress = speechProgress(current, novaNow())
        const head = frameState.nova.head
        const visible = progress.visible && head.visible
        bubble.dataset.visible = String(visible)
        bubble.dataset.typing = String(progress.talking)
        if (!visible || !current) return
        const shown = current.text.slice(0, progress.shown)
        if (text.textContent !== shown) text.textContent = shown

        const width = bubble.offsetWidth
        const height = bubble.offsetHeight
        const x = Math.min(Math.max(MARGIN, head.x - SIDE_GAP - width), window.innerWidth - width - MARGIN)
        const y = Math.min(Math.max(MARGIN, head.y - height * 0.35 + DROP), window.innerHeight - height - MARGIN)
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
        {!consoleOpen && speech ? `Nova : ${speech.text}` : ''}
      </p>
    </>
  )
}
