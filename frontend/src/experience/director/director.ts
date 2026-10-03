import { matchesQuery, REDUCED_MOTION_QUERY } from '../../hooks/useMediaQuery'
import { FilmDirector } from './FilmDirector'
import { useDirectorStore } from './directorStore'

/** The one film of the app: the interface sends it commands, the 3D stages read its state every frame. */
export const director = new FilmDirector(
  (phase) => useDirectorStore.getState().setPhase(phase),
  matchesQuery(REDUCED_MOTION_QUERY),
)
