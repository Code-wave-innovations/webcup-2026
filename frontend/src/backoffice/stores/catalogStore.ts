import { create } from 'zustand'
import { INTERRUPTIONS, SERVICES } from '../mocks/catalog'
import type { CityService, ServiceInterruption } from '../mocks/types'
import { toast } from './toastStore'

interface CatalogState {
  services: CityService[]
  interruptions: ServiceInterruption[]
}

export const useCatalogStore = create<CatalogState>()(() => ({ services: SERVICES, interruptions: INTERRUPTIONS }))

let nextInterruptionId = 100

const findService = (id: number) => useCatalogStore.getState().services.find((s) => s.id === id)

/* Simulated catalog administration (D05, F28, F38). */

export function updateService(id: number, change: Partial<CityService>) {
  const service = findService(id)
  if (!service) return
  useCatalogStore.setState((s) => ({ services: s.services.map((x) => (x.id === id ? { ...x, ...change } : x)) }))
  const featured = 'is_featured' in change && Object.keys(change).length === 1
  if (featured) toast(change.is_featured ? `${service.name} mis en avant` : `${service.name} retiré de la mise en avant`, 'info')
  else toast(`${service.name} enregistré`)
}

export function addInterruption(input: Omit<ServiceInterruption, 'id' | 'created_by_id'>, actorId: number) {
  const interruption: ServiceInterruption = { ...input, id: nextInterruptionId++, created_by_id: actorId }
  useCatalogStore.setState((s) => ({ interruptions: [interruption, ...s.interruptions] }))
  const service = findService(input.service_id)
  toast(`Interruption déclarée sur ${service?.name ?? 'le service'}`, 'alert')
}

export function endInterruption(id: number) {
  const interruption = useCatalogStore.getState().interruptions.find((i) => i.id === id)
  if (!interruption) return
  const now = new Date().toISOString()
  useCatalogStore.setState((s) => ({ interruptions: s.interruptions.map((i) => (i.id === id ? { ...i, ends_at: now } : i)) }))
  const service = findService(interruption.service_id)
  toast(`${service?.name ?? 'Service'} de nouveau disponible`)
}
