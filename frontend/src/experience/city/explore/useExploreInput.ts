import { useEffect, useRef } from 'react'
import { clamp } from '../../../lib/math'
import { director } from '../../director/director'
import { EXPLORE_PITCH_MAX, EXPLORE_PITCH_MIN } from './exploreCamera'
import { exploreActions } from './exploreActions'

const LOOK = 0.0045
const KEYS: Record<string, { x: number; z: number }> = {
  KeyW: { x: 0, z: 1 },
  ArrowUp: { x: 0, z: 1 },
  KeyS: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: -1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

/**
 * Writes the stick and the orbit while the visitor is on the streets: keyboard, mouse drag, optional joystick.
 */
export function useExploreInput(enabled: boolean) {
  const keys = useRef({ x: 0, z: 0 })
  const stick = useRef({ x: 0, z: 0 })
  const look = useRef(false)

  useEffect(() => {
    if (!enabled) {
      director.roam.move.x = director.roam.move.z = 0
      keys.current.x = keys.current.z = 0
      stick.current.x = stick.current.z = 0
      return
    }

    const apply = () => {
      director.roam.move.x = clamp(keys.current.x + stick.current.x, -1, 1)
      director.roam.move.z = clamp(keys.current.z + stick.current.z, -1, 1)
    }

    const pressed = new Set<string>()
    const refreshKeys = () => {
      let x = 0
      let z = 0
      pressed.forEach((code) => {
        const dir = KEYS[code]
        if (!dir) return
        x += dir.x
        z += dir.z
      })
      keys.current.x = clamp(x, -1, 1)
      keys.current.z = clamp(z, -1, 1)
      apply()
    }

    const down = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      if (event.code === 'Escape') {
        exploreActions.leave()
        return
      }
      if (!KEYS[event.code]) return
      event.preventDefault()
      pressed.add(event.code)
      refreshKeys()
    }
    const up = (event: KeyboardEvent) => {
      if (!KEYS[event.code]) return
      pressed.delete(event.code)
      refreshKeys()
    }
    const onMove = (event: PointerEvent) => {
      if (!look.current) return
      director.roam.orbit.yaw -= event.movementX * LOOK
      director.roam.orbit.pitch = clamp(director.roam.orbit.pitch + event.movementY * LOOK, EXPLORE_PITCH_MIN, EXPLORE_PITCH_MAX)
    }
    const stopLook = () => {
      look.current = false
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stopLook)
    window.addEventListener('pointercancel', stopLook)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stopLook)
      window.removeEventListener('pointercancel', stopLook)
      director.roam.move.x = director.roam.move.z = 0
    }
  }, [enabled])

  return {
    beginLook: () => {
      look.current = true
    },
    setStick: (x: number, z: number) => {
      stick.current.x = clamp(x, -1, 1)
      stick.current.z = clamp(z, -1, 1)
      director.roam.move.x = clamp(keys.current.x + stick.current.x, -1, 1)
      director.roam.move.z = clamp(keys.current.z + stick.current.z, -1, 1)
    },
  }
}
