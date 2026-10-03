import { create } from 'zustand'

export type ToastTone = 'ok' | 'info' | 'alert'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  dismiss: (id: number) => void
}

const VISIBLE_MS = 4200
let nextId = 1

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Back-office confirmation, stacked top-right and read out by screen readers. */
export function toast(message: string, tone: ToastTone = 'ok'): void {
  const id = nextId++
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }))
  setTimeout(() => useToastStore.getState().dismiss(id), VISIBLE_MS)
}
