import { messageFor } from '../../api/errors'
import { isNetworkFailure } from '../../api/essentialCache'
import { useLatestAnnouncements } from '../../api/announcements'
import type { AnnouncementCategory } from '../../api/types'
import { useNow } from '../../hooks/useNow'
import { Icon } from '../../ui/Icon'
import { Row, RowButton, RowButtons, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { useAlertFeed } from './alertFeedStore'
import { formatWhen, SEVERITY, SEVERITY_ICON, zoneLabel } from './alertModel'
import styles from './AnnouncementList.module.css'

const CATEGORY: Record<AnnouncementCategory, string> = {
  NEWS: 'Actualité',
  SERVICE_CHANGE: 'Changement de service',
  PRACTICAL_INFO: 'Information pratique',
  EVENT: 'Événement',
}

/**
 * One channel for the whole city: the alerts in force (D18, F29), each reopened in full on a click,
 * then the latest announcements (D06). An alert that does not concern me is listed, not pushed.
 */
export function AnnouncementList() {
  const now = useNow()
  const alerts = useAlertFeed((s) => s.alerts)
  const review = useAlertFeed((s) => s.review)
  const announcements = useLatestAnnouncements(3)

  return (
    <>
      {alerts.length > 0 && (
        <RowButtons role="group" aria-label="Alertes en cours">
          {alerts.map((alert) => (
            <RowButton key={alert.id} className={styles.alert} data-severity={alert.severity} onClick={() => review(alert.id)}>
              <span className={styles.icon} aria-hidden="true">
                <Icon name={SEVERITY_ICON[alert.severity]} size={16} />
              </span>
              <span>
                <small>
                  {SEVERITY[alert.severity].label} · {zoneLabel(alert)}
                </small>
                <strong>{alert.title}</strong>
                <small>{alert.concerns_me ? 'Vous êtes concerné·e · voir les consignes' : 'Ne concerne pas votre quartier'}</small>
              </span>
            </RowButton>
          ))}
        </RowButtons>
      )}

      {announcements.isError && announcements.data && isNetworkFailure(announcements.error) && (
        <p className={text.note}>Dernières annonces reçues. Elles se mettront à jour au retour du réseau.</p>
      )}
      {announcements.isError && announcements.data && !isNetworkFailure(announcements.error) && (
        <p className={text.error}>{messageFor(announcements.error)}</p>
      )}
      {announcements.isError && !announcements.data ? (
        <p className={text.error}>{messageFor(announcements.error)}</p>
      ) : (
        <RowList aria-label="Dernières annonces" aria-busy={announcements.isPending}>
          {announcements.data?.map((a) => (
            <Row key={a.id}>
              <span>
                <small>
                  {CATEGORY[a.category]}
                  {a.published_at && ` · ${formatWhen(a.published_at, now)}`}
                  {a.is_important && <b className={styles.important}> · Importante</b>}
                </small>
                <strong>{a.title}</strong>
                {a.summary && <small>{a.summary}</small>}
              </span>
            </Row>
          ))}
        </RowList>
      )}
    </>
  )
}
