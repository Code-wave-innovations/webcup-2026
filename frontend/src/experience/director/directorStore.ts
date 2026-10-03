import { create } from 'zustand'

/** WebGL availability: `unsupported` shows the painted fallback sky instead of the 3D scene. */
export type EngineStatus = 'loading' | 'ready' | 'unsupported'

/**
 * Where the film is. `approach`: cockpit, before login. `entry`: atmospheric entry, still in the cockpit.
 * `descent`: flying down to the city, the city interface is not shown yet. `city`: arrived, the site scrolls.
 */
export type FilmPhase = 'approach' | 'entry' | 'descent' | 'city'

/** Report shown by the light beam over dome 3: -1 none, 0 received → 3 resolved. */
export type SignalStatus = -1 | 0 | 1 | 2 | 3

interface DirectorState {
  status: EngineStatus
  phase: FilmPhase
  /** letterbox bars during the entry */
  cinematic: boolean
  alert: boolean
  signalStatus: SignalStatus
  /** a console page (/ville/*) covers the city: no loading screen, the scene stops redrawing */
  console: boolean
  setStatus: (status: EngineStatus) => void
  setPhase: (phase: FilmPhase) => void
  setCinematic: (cinematic: boolean) => void
  setAlert: (alert: boolean) => void
  setSignalStatus: (signalStatus: SignalStatus) => void
  setConsole: (console: boolean) => void
}

/** Low-frequency film state shared by the DOM and the 3D (per-frame values live in `frameState`). */
export const useDirectorStore = create<DirectorState>()((set) => ({
  status: 'loading',
  phase: 'approach',
  cinematic: false,
  alert: false,
  signalStatus: -1,
  console: false,
  setStatus: (status) => set({ status }),
  setPhase: (phase) => set({ phase }),
  setCinematic: (cinematic) => set({ cinematic }),
  setAlert: (alert) => set({ alert }),
  setSignalStatus: (signalStatus) => set({ signalStatus }),
  setConsole: (console) => set({ console }),
}))
