import { useEffect, useRef } from 'react'
import { useDirectorStore } from '../director/directorStore'
import { frameBus, frameState } from '../director/frameState'
import { defineMessages, useMessages } from '../../i18n'
import { nova, novaSignals } from './behavior/novaStore'
import styles from './NovaHitZone.module.css'

const messages = defineMessages({ label: 'Nova, votre guide. Lui dire bonjour' }, { label: 'Nova, your guide. Say hello' })

const setCurious = (on: boolean) => () => {
  novaSignals.curious = on
}

/**
 * The film sits behind the interface, so Nova cannot be hovered in the canvas: an invisible button
 * follows its silhouette on screen. Hover or focus makes it curious, a click or Enter pokes it.
 */
export function NovaHitZone() {
  const ref = useRef<HTMLButtonElement>(null)
  const consoleOpen = useDirectorStore((s) => s.console)
  const m = useMessages(messages)

  useEffect(() => {
    const unsubscribe = frameBus.subscribe(() => {
      const button = ref.current
      if (!button) return
      if (useDirectorStore.getState().console) {
        if (button.dataset.visible !== 'false') button.dataset.visible = 'false'
        novaSignals.curious = false
        return
      }
      const { box } = frameState.nova
      const visible = box.visible && box.height > 24
      if (button.dataset.visible !== String(visible)) button.dataset.visible = String(visible)
      if (!visible) return
      button.style.transform = `translate3d(${box.left.toFixed(1)}px,${box.top.toFixed(1)}px,0)`
      const width = `${box.width.toFixed(0)}px`
      const height = `${box.height.toFixed(0)}px`
      if (button.style.width !== width) button.style.width = width
      if (button.style.height !== height) button.style.height = height
    })
    return () => {
      unsubscribe()
      novaSignals.curious = false
    }
  }, [])

  if (consoleOpen) return null

  return (
    <button
      ref={ref}
      type="button"
      className={styles.zone}
      data-visible="false"
      aria-label={m.label}
      onPointerEnter={setCurious(true)}
      onPointerLeave={setCurious(false)}
      onFocus={setCurious(true)}
      onBlur={setCurious(false)}
      onClick={nova.poke}
    />
  )
}
