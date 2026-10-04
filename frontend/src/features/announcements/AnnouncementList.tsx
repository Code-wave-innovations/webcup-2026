import { messageFor } from '../../api/errors'
import { isNetworkFailure } from '../../api/essentialCache'
import { useLatestAnnouncements } from '../../api/announcements'
import { useNow } from '../../hooks/useNow'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Icon } from '../../ui/Icon'
import { Row, RowButton, RowButtons, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { useAlertFeed } from './alertFeedStore'
import { formatWhen, SEVERITY_ICON, severityLabel, zoneLabel } from './alertModel'
import styles from './AnnouncementList.module.css'

const messages = defineMessages(
  {
    category: { NEWS: 'Actualité', SERVICE_CHANGE: 'Changement de service', PRACTICAL_INFO: 'Information pratique', EVENT: 'Événement' },
    currentAlerts: 'Alertes en cours',
    concerned: 'Vous êtes concerné·e · voir les consignes',
    notConcerned: 'Ne concerne pas votre quartier',
    lastKnown: 'Dernières annonces reçues. Elles se mettront à jour au retour du réseau.',
    latest: 'Dernières annonces',
    important: ' · Importante',
  },
  {
    category: { NEWS: 'News', SERVICE_CHANGE: 'Service change', PRACTICAL_INFO: 'Practical information', EVENT: 'Event' },
    currentAlerts: 'Current alerts',
    concerned: 'This concerns you · see the instructions',
    notConcerned: 'Does not concern your district',
    lastKnown: 'Latest announcements received. They will update when the network is back.',
    latest: 'Latest announcements',
    important: ' · Important',
  },
)

/**
 * One channel for the whole city: the alerts in force (D18, F29), each reopened in full on a click,
 * then the latest announcements (D06). An alert that does not concern me is listed, not pushed.
 */
export function AnnouncementList() {
  const now = useNow()
  const m = useMessages(messages)
  const locale = useLocale()
  const alerts = useAlertFeed((s) => s.alerts)
  const review = useAlertFeed((s) => s.review)
  const announcements = useLatestAnnouncements(3)

  return (
    <>
      {alerts.length > 0 && (
        <RowButtons role="group" aria-label={m.currentAlerts}>
          {alerts.map((alert) => (
            <RowButton key={alert.id} className={styles.alert} data-severity={alert.severity} onClick={() => review(alert.id)}>
              <span className={styles.icon} aria-hidden="true">
                <Icon name={SEVERITY_ICON[alert.severity]} size={16} />
              </span>
              <span>
                <small>
                  {severityLabel(alert.severity, locale)} · {zoneLabel(alert, locale)}
                </small>
                <strong>{alert.title}</strong>
                <small>{alert.concerns_me ? m.concerned : m.notConcerned}</small>
              </span>
            </RowButton>
          ))}
        </RowButtons>
      )}

      {announcements.isError && announcements.data && isNetworkFailure(announcements.error) && (
        <p className={text.note}>{m.lastKnown}</p>
      )}
      {announcements.isError && announcements.data && !isNetworkFailure(announcements.error) && (
        <p className={text.error}>{messageFor(announcements.error)}</p>
      )}
      {announcements.isError && !announcements.data ? (
        <p className={text.error}>{messageFor(announcements.error)}</p>
      ) : (
        <RowList aria-label={m.latest} aria-busy={announcements.isPending}>
          {announcements.data?.map((a) => (
            <Row key={a.id}>
              <span>
                <small>
                  {m.category[a.category]}
                  {a.published_at && ` · ${formatWhen(a.published_at, now, locale)}`}
                  {a.is_important && <b className={styles.important}>{m.important}</b>}
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
