import styles from './FilmLoadingScreen.module.css'

/**
 * The film's loading screen: the fallback while its code downloads, then the cover while the 3D builds.
 * It fades out once the film is ready, or at once on a console page.
 */
export function FilmLoadingScreen({ done = false }: { done?: boolean }) {
  return (
    <div className={styles.loading} data-done={done} role="status">
      <b>Liaison avec le contrôle d'approche</b>
      <i />
    </div>
  )
}
