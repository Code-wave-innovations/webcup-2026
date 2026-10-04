import { create } from 'zustand'

const STORAGE_KEY = 'nova:son'

/** Sound plays unless this browser stored an explicit mute. */
function remembered(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

/** The visitor's choice: sound plays by default, and a mute is remembered on this browser. */
export const useSoundStore = create<{ enabled: boolean; toggle: () => void }>()((set, get) => ({
  enabled: typeof window === 'undefined' || remembered(),
  toggle: () => {
    const enabled = !get().enabled
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {
      // private window or blocked storage: the choice lasts for this visit only
    }
    set({ enabled })
  },
}))
