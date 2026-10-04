import { currentLocale, defineMessages, messagesFor, type Locale } from '../i18n'
import { readScenePreference, writeScenePreference, type ScenePreference } from './preferences'
import { isLightPath, pathForMode } from './scenePaths'

/**
 * F96 / D20: the light version (no 3D, linear pages, system fonts, no voice) or the complete film.
 * Decided once, before the first render, because it chooses which chunks the page downloads at all.
 * The light version is the `/leger` routes; the complete film keeps `/`, `/ville` and `/nova`.
 * Switching saves the choice and reloads on the other version's URL.
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

/**
 * The version for this URL, and the path it should use. Opening `/leger` shows the light version.
 * `?leger=0` sends that URL back to the film. A light decision on `/`, `/ville` or `/nova` moves to `/leger`.
 */
export function sceneRoute(
  pathname: string,
  preference: ScenePreference,
  signals: SceneSignals,
  query?: ScenePreference,
): { scene: SceneDecision; pathname: string } {
  let scene = resolveScene(query ?? preference, signals)
  if (isLightPath(pathname) && scene.mode === 'complete' && query !== 'complete') {
    scene = { mode: 'light', reason: 'choice' }
  }
  return { scene, pathname: pathForMode(pathname, scene.mode) }
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

function boot(): { scene: SceneDecision; redirecting: boolean } {
  const url = new URL(window.location.href)
  const query = urlPreference(url.search)
  if (query) {
    writeScenePreference(query)
    url.searchParams.delete('leger')
  }
  const { scene, pathname } = sceneRoute(url.pathname, query ?? readScenePreference(), readSignals(), query)
  const redirecting = pathname !== window.location.pathname || url.search !== window.location.search
  if (redirecting) {
    url.pathname = pathname
    window.location.replace(url.href)
  }
  return { scene, redirecting }
}

const booted = typeof window === 'undefined' ? { scene: { mode: 'complete', reason: 'default' } as SceneDecision, redirecting: false } : boot()

/** The mode of this page load. */
export const SCENE: SceneDecision = booted.scene

/** True while the address bar is moving to the version's own URL; the app renders nothing in between. */
export const SCENE_REDIRECTING = booted.redirecting

export const isLightScene = SCENE.mode === 'light'

/** Saves the visitor's choice and reloads on that version's URL (`/leger` or the film's paths). */
export function switchScene(mode: SceneMode): void {
  writeScenePreference(mode)
  const url = new URL(window.location.href)
  url.searchParams.delete('leger')
  url.pathname = pathForMode(url.pathname, mode)
  window.location.assign(url.href)
}
