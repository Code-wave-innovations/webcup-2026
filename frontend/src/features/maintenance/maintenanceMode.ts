import { usePublicSettings } from '../../api/settings'

/** D08: the citizen space is read-only while this is on. Writes stay refused by the API. */
export function useMaintenanceMode(): boolean {
  return usePublicSettings().data?.maintenance_mode === true
}
