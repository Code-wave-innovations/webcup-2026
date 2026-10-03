import { POIS, type PoiId } from '../city/cityConfig'

/**
 * URL switches inherited from the prototype, used to frame a given moment of the film for screenshots
 * and visual checks (e.g. `/?entree=3`, `/ville?vue=2&fige=1`).
 */
export interface DebugParams {
  /** fixed resolution scale (disables adaptive resolution) — `?qualite=0.6` */
  quality?: number
  /** planet texture width — `?texture=1024` */
  textureSize?: number
  /** force the 8-bit pipeline — `?ldr=1` */
  ldr: boolean
  /** disable multisampling — `?sansaa=1` */
  noAntialias: boolean
  /** camera jumps to the scroll position instead of easing — `?net=1` */
  instantCamera: boolean
  /** fixed time of day in the city, 0 = afternoon, 1 = night — `?heure=0.5` */
  hour?: number
  /** allow long frames (the film advances in real time even on a slow machine) — `?rapide=1` */
  fastClock: boolean
  /** freeze the entry sequence at its current time — `?fige=1` */
  frozen: boolean
  /** jump straight to the city, at this camera pose — `?vue=2` */
  view?: number
  /** jump into the entry sequence at this time in seconds — `?entree=3` */
  entry?: number
  /** jump into the descent at this progress — `?arrivee=0.5` */
  arrival?: number
  /** with `?vue`: explore mode, Nova standing on this site — `?site=golf` */
  site?: PoiId
}

function parse(search: string): DebugParams {
  const params = new URLSearchParams(search)
  const num = (key: string) => {
    const raw = params.get(key)
    if (raw === null || raw === '') return undefined
    const value = Number(raw)
    return Number.isFinite(value) ? value : undefined
  }
  const flag = (key: string) => params.has(key) && params.get(key) !== '0'
  return {
    quality: num('qualite'),
    textureSize: num('texture'),
    ldr: flag('ldr'),
    noAntialias: flag('sansaa'),
    instantCamera: flag('net'),
    hour: num('heure'),
    fastClock: flag('rapide'),
    frozen: flag('fige'),
    view: num('vue'),
    entry: num('entree'),
    arrival: num('arrivee'),
    site: POIS.find((poi) => poi.id === params.get('site'))?.id,
  }
}

export const debugParams: DebugParams = parse(typeof window === 'undefined' ? '' : window.location.search)

/** `?vue` / `?arrivee` land in the city without a login (signed in with the resident demo account). */
export const debugJump = debugParams.view !== undefined || debugParams.arrival !== undefined
