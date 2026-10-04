/**
 * Display preferences shared by the citizen app and the back-office (PLAN-08), kept in this browser so they
 * apply before sign-in, on the airlock too. Every read and write tolerates blocked storage (private window).
 */

/** F96 / D20: `auto` lets the network and the device decide, the other two are the visitor's explicit choice. */
export type ScenePreference = 'auto' | 'complete' | 'light'

const SCENE_KEY = 'nova:affichage'
/** set once a phone visitor chose to keep the 3D, so the light version is not offered again */
const OFFER_KEY = 'nova:affichage-propose'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // blocked storage: the choice lasts for this page only
  }
}

export function readScenePreference(): ScenePreference {
  const value = read(SCENE_KEY)
  return value === 'complete' || value === 'light' ? value : 'auto'
}

export function writeScenePreference(preference: ScenePreference): void {
  write(SCENE_KEY, preference)
}

export function lightOfferDeclined(): boolean {
  return read(OFFER_KEY) === '0'
}

export function declineLightOffer(): void {
  write(OFFER_KEY, '0')
}
