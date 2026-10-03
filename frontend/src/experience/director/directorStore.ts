import { create } from 'zustand'
import type { PoiId } from '../city/cityConfig'
import type { FlightPhase } from '../city/explore/flightPath'

/** WebGL availability: `unsupported` shows the painted fallback sky instead of the 3D scene. */
export type EngineStatus = 'loading' | 'ready' | 'unsupported'

/**
 * Where the film is. `approach`: cockpit, before login. `entry`: atmospheric entry, still in the cockpit.
 * `descent`: flying down to the city, the city interface is not shown yet. `city`: arrived, the site scrolls.
 * `explore`: the visitor walks Nova on the ground (city stage still drawn).
 */
export type FilmPhase = 'approach' | 'entry' | 'descent' | 'city' | 'explore'

/** Report shown by the light beam over dome 3: -1 none, 0 received → 3 resolved. */
export type SignalStatus = -1 | 0 | 1 | 2 | 3

/** Where the explore visit stands, for the interface (the per-frame flight values are read from `director.flight`). */
export interface ExploreStatus {
  /** the site Nova stands on */
  site: PoiId | null
  /** the site it is flying to */
  destination: PoiId | null
  flight: FlightPhase | null
  /** on the way back to the flyover */
  leaving: boolean
}

interface DirectorState {
  status: EngineStatus
  phase: FilmPhase
  /** letterbox bars during the entry */
  cinematic: boolean
  alert: boolean
  signalStatus: SignalStatus
  explore: ExploreStatus
  setStatus: (status: EngineStatus) => void
  setPhase: (phase: FilmPhase) => void
  setCinematic: (cinematic: boolean) => void
  setAlert: (alert: boolean) => void
  setSignalStatus: (signalStatus: SignalStatus) => void
  setExplore: (explore: ExploreStatus) => void
}

/** Low-frequency film state shared by the DOM and the 3D (per-frame values live in `frameState`). */
export const useDirectorStore = create<DirectorState>()((set) => ({
  status: 'loading',
  phase: 'approach',
  cinematic: false,
  alert: false,
  signalStatus: -1,
  explore: { site: null, destination: null, flight: null, leaving: false },
  setStatus: (status) => set({ status }),
  setPhase: (phase) => set({ phase }),
  setCinematic: (cinematic) => set({ cinematic }),
  setAlert: (alert) => set({ alert }),
  setSignalStatus: (signalStatus) => set({ signalStatus }),
  setExplore: (explore) => set({ explore }),
}))
