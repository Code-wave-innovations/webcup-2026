import { describe, expect, it } from 'vitest'
import { resolveScene, sceneRoute, urlPreference, type SceneSignals } from './sceneMode'

const fast: SceneSignals = { saveData: false, reducedData: false, slowNetwork: false, webgl2: true }

describe('resolveScene', () => {
  it('plays the film by default on a capable device and network', () => {
    expect(resolveScene('auto', fast)).toEqual({ mode: 'complete', reason: 'default' })
  })

  it('starts light on its own with the data saver, reduced data or a 2G network', () => {
    expect(resolveScene('auto', { ...fast, saveData: true })).toEqual({ mode: 'light', reason: 'save-data' })
    expect(resolveScene('auto', { ...fast, reducedData: true })).toEqual({ mode: 'light', reason: 'reduced-data' })
    expect(resolveScene('auto', { ...fast, slowNetwork: true })).toEqual({ mode: 'light', reason: 'slow-network' })
  })

  it('lets an explicit choice win over the network signals', () => {
    const slow = { ...fast, saveData: true, slowNetwork: true }
    expect(resolveScene('complete', slow)).toEqual({ mode: 'complete', reason: 'choice' })
    expect(resolveScene('light', fast)).toEqual({ mode: 'light', reason: 'choice' })
  })

  it('stays light without WebGL2, even when the film was chosen', () => {
    expect(resolveScene('complete', { ...fast, webgl2: false })).toEqual({ mode: 'light', reason: 'no-webgl' })
    expect(resolveScene('auto', { ...fast, webgl2: false })).toEqual({ mode: 'light', reason: 'no-webgl' })
  })
})

describe('sceneRoute', () => {
  it('keeps the film on its own paths, and moves a light decision under /leger', () => {
    expect(sceneRoute('/ville', 'auto', fast).pathname).toBe('/ville')
    expect(sceneRoute('/ville', 'light', fast)).toEqual({
      scene: { mode: 'light', reason: 'choice' },
      pathname: '/leger/ville',
    })
    expect(sceneRoute('/', 'auto', { ...fast, slowNetwork: true }).pathname).toBe('/leger')
  })

  it('opens /leger as the light version, and ?leger=0 sends it back to the film', () => {
    expect(sceneRoute('/leger/ville/contact', 'complete', fast).scene.mode).toBe('light')
    expect(sceneRoute('/leger/ville/contact', 'complete', fast).pathname).toBe('/leger/ville/contact')
    expect(sceneRoute('/leger/nova', 'auto', fast, 'complete')).toEqual({
      scene: { mode: 'complete', reason: 'choice' },
      pathname: '/nova',
    })
  })

  it('leaves the back-office on its URL when the light version is the choice', () => {
    const route = sceneRoute('/admin', 'light', fast)
    expect(route.scene.mode).toBe('light')
    expect(route.pathname).toBe('/admin')
  })
})

describe('urlPreference', () => {
  it('reads ?leger=1 and ?leger=0, and ignores its absence', () => {
    expect(urlPreference('?leger=1')).toBe('light')
    expect(urlPreference('?leger')).toBe('light')
    expect(urlPreference('?vue=2&leger=0')).toBe('complete')
    expect(urlPreference('?vue=2')).toBeUndefined()
  })
})
