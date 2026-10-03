import { useEffect } from 'react'
import { useDirectorStore } from '../../experience/director/directorStore'
import { Button } from '../../ui/Button'
import { bindCityAlertSound } from './alertSound'
import styles from './AlertBanner.module.css'

/** City-wide alert from the High Council, on every screen. */
export function AlertBanner() {
  const alert = useDirectorStore((s) => s.alert)
  const setAlert = useDirectorStore((s) => s.setAlert)

  useEffect(() => bindCityAlertSound(), [])

  if (!alert) return null
  return (
    <div className={styles.banner} role="alert">
      <b>Alerte au dôme 2</b>
      <p>Sas bloqué en position ouverte. Restez à l'intérieur et attendez les consignes.</p>
      <Button variant="inverse" small onClick={() => setAlert(false)}>
        Lever l'alerte
      </Button>
    </div>
  )
}
