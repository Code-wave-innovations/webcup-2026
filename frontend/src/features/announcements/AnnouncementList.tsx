import { useDirectorStore } from '../../experience/director/directorStore'
import { Button } from '../../ui/Button'
import { Row, RowList } from '../../ui/Rows'
import { ALERT_ANNOUNCEMENT, ANNOUNCEMENTS } from './announcements'

/** One channel for the whole city: announcements, instructions, alerts. */
export function AnnouncementList() {
  const alert = useDirectorStore((s) => s.alert)
  const setAlert = useDirectorStore((s) => s.setAlert)
  const items = alert ? [ALERT_ANNOUNCEMENT, ...ANNOUNCEMENTS] : ANNOUNCEMENTS

  return (
    <>
      <RowList>
        {items.map((a) => (
          <Row key={a.title}>
            <span>
              <small>{a.source}</small>
              <strong>{a.title}</strong>
              {a.detail && <small>{a.detail}</small>}
            </span>
          </Row>
        ))}
      </RowList>
      <Button variant="ghost" small onClick={() => setAlert(!alert)}>
        {alert ? "Lever l'alerte" : 'Simuler une alerte'}
      </Button>
    </>
  )
}
