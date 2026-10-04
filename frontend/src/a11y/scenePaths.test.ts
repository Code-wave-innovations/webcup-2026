import { describe, expect, it } from 'vitest'
import { barePath, isCitizenPath, isLightPath, pathForMode, prefixTo, toLight } from './scenePaths'

describe('scene paths', () => {
  it('recognises the light prefix and strips it', () => {
    expect(isLightPath('/leger')).toBe(true)
    expect(isLightPath('/leger/ville/contact')).toBe(true)
    expect(isLightPath('/ville')).toBe(false)
    expect(isLightPath('/legers')).toBe(false)
    expect(barePath('/leger')).toBe('/')
    expect(barePath('/leger/ville/contact')).toBe('/ville/contact')
    expect(barePath('/ville')).toBe('/ville')
  })

  it('treats the airlock, the city and the chat as citizen paths', () => {
    expect(isCitizenPath('/')).toBe(true)
    expect(isCitizenPath('/ville/espace/demandes')).toBe(true)
    expect(isCitizenPath('/nova')).toBe(true)
    expect(isCitizenPath('/leger/nova')).toBe(true)
    expect(isCitizenPath('/agent')).toBe(false)
    expect(isCitizenPath('/equipe')).toBe(false)
  })

  it('maps a citizen path onto the version, and leaves the back-office where it is', () => {
    expect(toLight('/ville/contact')).toBe('/leger/ville/contact')
    expect(toLight('/')).toBe('/leger')
    expect(toLight('/leger/ville')).toBe('/leger/ville')
    expect(pathForMode('/ville', 'light')).toBe('/leger/ville')
    expect(pathForMode('/leger/ville/contact', 'complete')).toBe('/ville/contact')
    expect(pathForMode('/leger', 'complete')).toBe('/')
    expect(pathForMode('/admin/audit', 'light')).toBe('/admin/audit')
    expect(pathForMode('/admin/audit', 'complete')).toBe('/admin/audit')
  })

  it('prefixes citizen targets and keeps search, hash and staff paths', () => {
    expect(prefixTo('/ville/annonces')).toEqual({ pathname: '/leger/ville/annonces' })
    expect(prefixTo('/?retour=%2Fville')).toEqual({ pathname: '/leger', search: '?retour=%2Fville' })
    expect(prefixTo('/ville#observatoire')).toEqual({ pathname: '/leger/ville', hash: '#observatoire' })
    expect(prefixTo('/agent')).toBe('/agent')
    expect(prefixTo({ pathname: '/nova', search: '?q=1' })).toEqual({ pathname: '/leger/nova', search: '?q=1' })
    expect(prefixTo('contact')).toBe('contact')
  })
})
