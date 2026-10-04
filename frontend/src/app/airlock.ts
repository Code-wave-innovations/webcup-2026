import { isLightScene } from '../a11y/sceneMode'
import { useDirectorStore } from '../experience/director/directorStore'

/**
 * Before showing the airlock from the city: the film fades back to the cockpit. Nothing to do in the light
 * version (F96). The director is imported on demand so the console pages never pull the 3D engine; once the
 * film runs, the module is already loaded and resolves at once.
 */
export function rewindToCockpit(): void {
  if (isLightScene) return
  const store = useDirectorStore.getState()
  if (store.status === 'ready') {
    void import('../experience/director/director').then(({ director }) => {
      if (director.phase !== 'approach') director.exit()
    })
  } else if (store.phase !== 'approach') {
    store.setPhase('approach')
  }
}

/** The airlock, which brings the visitor back to `from` once signed in. */
export const airlockPath = (from?: string) => ({ pathname: '/', search: from ? `?retour=${encodeURIComponent(from)}` : '' })
