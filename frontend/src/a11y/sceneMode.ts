import { currentLocale, defineMessages, messagesFor, type Locale } from '../i18n'
import { readScenePreference, writeScenePreference, type ScenePreference } from './preferences'

/**
 * F96 / D20: the light version (no 3D, linear pages, system fonts, no voice) or the complete film.
 * Decided once, before the first render, because it chooses which chunks the page downloads at all.
 * Switching saves the choice and reloads the page at the same URL.
 */
export type SceneMode = 'complete' | 'light'
export type SceneReason = 'choice' | 'save-data' | 'reduced-data' | 'slow-network' | 'no-webgl' | 'default'

export interface SceneDecision {
  mode: SceneMode
  reason: SceneReason
}

export interface SceneSignals {
  /** the browser's data saver (`navigator.connection.saveData`, or the `Save-Data` setting) */
  saveData: boolean
  /** `prefers-reduced-data: reduce` */
  reducedData: boolean
  /** effective connection type `slow-2g` or `2g` */
  slowNetwork: boolean
  webgl2: boolean
}

/** Without WebGL2 the film cannot run whatever the choice; otherwise an explicit choice wins over the signals. */
export function resolveScene(preference: ScenePreference, signals: SceneSignals): SceneDecision {
  if (!signals.webgl2) return { mode: 'light', reason: 'no-webgl' }
  if (preference !== 'auto') return { mode: preference, reason: 'choice' }
  if (signals.saveData) return { mode: 'light', reason: 'save-data' }
  if (signals.reducedData) return { mode: 'light', reason: 'reduced-data' }
  if (signals.slowNetwork) return { mode: 'light', reason: 'slow-network' }
  return { mode: 'complete', reason: 'default' }
}

/** `?leger=1` forces the light version, `?leger=0` the complete one (demo, screenshots); absent: no change. */
export function urlPreference(search: string): ScenePreference | undefined {
  const value = new URLSearchParams(search).get('leger')
  if (value === null) return undefined
  return value === '0' ? 'complete' : 'light'
}

const reasonMessages = defineMessages(
  {
    'save-data': 'Économiseur de données détecté',
    'reduced-data': 'Économie de données demandée',
    'slow-network': 'Connexion lente détectée',
    'no-webgl': 'Affichage 3D indisponible sur cet appareil',
  },
  {
    'save-data': 'Data saver detected',
    'reduced-data': 'Reduced data requested',
    'slow-network': 'Slow connection detected',
    'no-webgl': '3D display unavailable on this device',
  },
)

/** Why the light version started by itself; null when it was the visitor's choice or the default. */
export function sceneReasonLabel(reason: SceneReason, locale: Locale = currentLocale()): string | null {
  if (reason === 'choice' || reason === 'default') return null
  return messagesFor(reasonMessages, locale)[reason]
}

export function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    // release the probe context at once: browsers cap how many can live together
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

export function readSignals(): SceneSignals {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  return {
    saveData: connection?.saveData === true,
    reducedData: window.matchMedia('(prefers-reduced-data: reduce)').matches,
    slowNetwork: connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g',
    webgl2: supportsWebGL2(),
  }
}

function decide(): SceneDecision {
  const fromUrl = urlPreference(window.location.search)
  if (fromUrl) writeScenePreference(fromUrl)
  return resolveScene(fromUrl ?? readScenePreference(), readSignals())
}

/** The mode of this page load. */
export const SCENE: SceneDecision = typeof window === 'undefined' ? { mode: 'complete', reason: 'default' } : decide()

export const isLightScene = SCENE.mode === 'light'

/** Saves the visitor's choice and reloads at the same URL (without `?leger`, which would override it). */
export function switchScene(mode: SceneMode): void {
  writeScenePreference(mode)
  const url = new URL(window.location.href)
  url.searchParams.delete('leger')
  // a plain replace would not reload when only the hash differs
  window.history.replaceState(window.history.state, '', url)
  window.location.reload()
}
