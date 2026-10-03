import { create } from 'zustand'

const VISIBLE_MS = 3600

interface ToastState {
  message: string | null
  /** increments on every announcement so the same text twice still restarts the animation */
  key: number
}

export const useToastStore = create<ToastState>()(() => ({ message: null, key: 0 }))

let hideTimer: ReturnType<typeof setTimeout> | undefined

/** Short confirmation at the bottom of the screen, read out by screen readers. */
export function announce(message: string): void {
  clearTimeout(hideTimer)
  useToastStore.setState((s) => ({ message, key: s.key + 1 }))
  hideTimer = setTimeout(() => useToastStore.setState({ message: null }), VISIBLE_MS)
}
