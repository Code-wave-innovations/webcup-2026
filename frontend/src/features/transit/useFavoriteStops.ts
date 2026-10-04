import { useUpdateMe } from '../../api/me'
import { useSessionUser } from '../../api/session'
import { favoriteStopsOf } from './transitText'

/** F36: the resident's favourite stops, saved in their preferences (signed-in residents only). */
export function useFavoriteStops() {
  const user = useSessionUser()
  const update = useUpdateMe()
  const ids = favoriteStopsOf(user?.preferences)

  // preferences are replaced as a whole by the server: keep the other keys (display settings…)
  const toggle = (stopId: number) => {
    if (!user) return
    const next = ids.includes(stopId) ? ids.filter((id) => id !== stopId) : [...ids, stopId]
    update.mutate({ preferences: { ...(user.preferences ?? {}), favorite_stops: next } })
  }

  return { ids, toggle, canSave: !!user, saving: update.isPending, error: update.error }
}
