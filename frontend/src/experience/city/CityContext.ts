import { createContext, useContext } from 'react'
import type { BakedTextures } from '../bake/bakePlanet'
import type { CityData } from './layout/generateCity'
import type { WorldUniforms } from './worldMaterial'
import type { IUniform } from 'three'

export interface CityContextValue {
  data: CityData
  textures: BakedTextures
  uniforms: WorldUniforms
  /** pixel size of point lights, shared by beacons and shuttles (differs in the half-size reflection) */
  pointScale: IUniform<number>
  hdr: boolean
}

export const CityContext = createContext<CityContextValue | null>(null)

export function useCity(): CityContextValue {
  const city = useContext(CityContext)
  if (!city) throw new Error('useCity must be used inside <CityStage>')
  return city
}
