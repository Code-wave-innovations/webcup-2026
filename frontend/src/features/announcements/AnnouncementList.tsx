import { ANNOUNCEMENT_CATEGORY_LABEL, useAnnouncements } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { isNetworkFailure } from '../../api/essentialCache'
import { formatPublished } from '../../lib/format'
import { ButtonRouteLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Pill } from '../../ui/Badges'
import { RowButton, RowButtons, RowLink, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { useAlertFeed } from './alertFeedStore'
import { SEVERITY, SEVERITY_ICON, zoneLabel } from './alertModel'
import styles from './AnnouncementList.module.css'

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

      {offline && <p className={text.note}>Dernières annonces reçues. Elles se mettront à jour au retour du réseau.</p>}
      {list.isError && items.length > 0 && !isNetworkFailure(list.error) && <p className={text.error}>{messageFor(list.error)}</p>}
      {list.isError && items.length === 0 ? (
        <p className={text.error}>{messageFor(list.error)}</p>
      ) : items.length === 0 && !list.isPending ? (
        <p className={text.note}>Aucune annonce pour le moment.</p>
      ) : (
        <RowList aria-label="Dernières annonces" aria-busy={list.isPending}>
          {items.map((announcement) => {
            const when = announcement.published_at ? formatPublished(announcement.published_at) : ANNOUNCEMENT_CATEGORY_LABEL[announcement.category]
            const source = announcement.service?.name ?? ANNOUNCEMENT_CATEGORY_LABEL[announcement.category]
            return (
              <RowLink key={announcement.id} to={`/ville/annonces/${announcement.id}`}>
                <small>
                  {source}, {when}
                  {announcement.is_important ? ' · Importante' : ''}
                </small>
                <strong>{announcement.title}</strong>
                {announcement.summary && <small>{announcement.summary}</small>}
                {announcement.is_important && <Pill tone="alert">Importante</Pill>}
              </RowLink>
            )
          })}
        </RowList>
      )}
      <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
        Toutes les annonces
      </ButtonRouteLink>
    </>
  )
}
