import { announcementCategoryLabel, useAnnouncements } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { isNetworkFailure } from '../../api/essentialCache'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { formatPublished } from '../../lib/format'
import { ButtonRouteLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Pill } from '../../ui/Badges'
import { RowButton, RowButtons, RowLink, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { useAlertFeed } from './alertFeedStore'
import { SEVERITY_ICON, severityLabel, zoneLabel } from './alertModel'
import styles from './AnnouncementList.module.css'

const messages = defineMessages(
  {
    currentAlerts: 'Alertes en cours',
    concerned: 'Vous êtes concerné·e · voir les consignes',
    notConcerned: 'Ne concerne pas votre quartier',
    lastKnown: 'Dernières annonces reçues. Elles se mettront à jour au retour du réseau.',
    none: 'Aucune annonce pour le moment.',
    latest: 'Dernières annonces',
    important: 'Importante',
    all: 'Toutes les annonces',
  },
  {
    currentAlerts: 'Current alerts',
    concerned: 'This concerns you · see the instructions',
    notConcerned: 'Does not concern your district',
    lastKnown: 'Latest announcements received. They will update when the network is back.',
    none: 'No announcements for now.',
    latest: 'Latest announcements',
    important: 'Important',
    all: 'All announcements',
  },
)

/**
 * One channel for the whole city: the alerts in force (D18, F29), each reopened in full on a click,
 * then the latest announcements (D06). An alert that does not concern me is listed, not pushed.
 */
export function AnnouncementList() {
  const alerts = useAlertFeed((s) => s.alerts)
  const review = useAlertFeed((s) => s.review)
  const list = useAnnouncements({ limit: 3 })
  const items = list.data?.data ?? []
  const offline = list.isError && items.length > 0 && isNetworkFailure(list.error)
  const m = useMessages(messages)
  const locale = useLocale()

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

      {offline && <p className={text.note}>{m.lastKnown}</p>}
      {list.isError && items.length > 0 && !isNetworkFailure(list.error) && <p className={text.error}>{messageFor(list.error)}</p>}
      {list.isError && items.length === 0 ? (
        <p className={text.error}>{messageFor(list.error)}</p>
      ) : items.length === 0 && !list.isPending ? (
        <p className={text.note}>{m.none}</p>
      ) : (
        <RowList aria-label={m.latest} aria-busy={list.isPending}>
          {items.map((announcement) => {
            const category = announcementCategoryLabel(announcement.category, locale)
            const when = announcement.published_at ? formatPublished(announcement.published_at, locale) : category
            const source = announcement.service?.name ?? category
            return (
              <RowLink key={announcement.id} to={`/ville/annonces/${announcement.id}`}>
                <small>
                  {source}, {when}
                  {announcement.is_important ? ` · ${m.important}` : ''}
                </small>
                <strong>{announcement.title}</strong>
                {announcement.summary && <small>{announcement.summary}</small>}
                {announcement.is_important && <Pill tone="alert">{m.important}</Pill>}
              </RowLink>
            )
          })}
        </RowList>
      )}
      <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
        {m.all}
      </ButtonRouteLink>
    </>
  )
}
