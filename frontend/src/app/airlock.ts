import { director } from '../experience/director/director'
import { useDirectorStore } from '../experience/director/directorStore'

/** Before showing the airlock from the city: the film fades back to the cockpit. */
export function rewindToCockpit(): void {
  const store = useDirectorStore.getState()
  if (store.status === 'ready') {
    if (director.phase !== 'approach') director.exit()
  } else if (store.phase !== 'approach') {
    store.setPhase('approach')
  }
}

/** The airlock, which brings the visitor back to `from` once signed in. */
export const airlockPath = (from?: string) => ({ pathname: '/', search: from ? `?retour=${encodeURIComponent(from)}` : '' })
