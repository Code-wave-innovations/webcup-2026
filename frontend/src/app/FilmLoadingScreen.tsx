import { defineMessages, useMessages } from '../i18n'
import styles from './FilmLoadingScreen.module.css'

const messages = defineMessages({ loading: "Liaison avec le contrôle d'approche" }, { loading: 'Connecting to approach control' })

/**
 * The film's loading screen: the fallback while its code downloads, then the cover while the 3D builds.
 * It fades out once the film is ready, or at once on a console page.
 */
export function FilmLoadingScreen({ done = false }: { done?: boolean }) {
  const m = useMessages(messages)
  return (
    <div className={styles.loading} data-done={done} role="status">
      <b>{m.loading}</b>
      <i />
    </div>
  )
}
