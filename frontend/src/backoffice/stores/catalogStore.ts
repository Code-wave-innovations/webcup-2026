import { create } from 'zustand'
import { SERVICES } from '../mocks/catalog'
import type { CityService } from '../mocks/types'

interface CatalogState {
  services: CityService[]
}

// Read by lib/lookups and the slots screen, still on simulated data (BO-08). The catalogue itself
// is managed through src/api/services.ts (BO-06).
export const useCatalogStore = create<CatalogState>()(() => ({ services: SERVICES }))
