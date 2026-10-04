import { Link } from 'react-router'
import { ANNOUNCEMENT_CATEGORY_LABEL, useAnnouncements } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { formatPublished } from '../../lib/format'
import { ButtonRouteLink } from '../../ui/Button'
import { Pill } from '../../ui/Badges'
import { Row, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'

/** The three latest publications, on the High Council section of the flyover (D06). */
export function AnnouncementList() {
  const list = useAnnouncements({ limit: 3 })

  if (list.isPending) return <p className={text.note}>Chargement des annonces…</p>
  if (list.isError) return <p className={text.error}>{messageFor(list.error)}</p>

  const items = list.data?.data ?? []
  if (items.length === 0) {
    return (
      <>
        <p className={text.note}>Aucune annonce pour le moment.</p>
        <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
          Toutes les annonces
        </ButtonRouteLink>
      </>
    )
  }

  return (
    <>
      <RowList>
        {items.map((announcement) => {
          const when = announcement.published_at ? formatPublished(announcement.published_at) : ANNOUNCEMENT_CATEGORY_LABEL[announcement.category]
          const source = announcement.service?.name ?? ANNOUNCEMENT_CATEGORY_LABEL[announcement.category]
          return (
            <Row key={announcement.id}>
              <Link to={`/ville/annonces/${announcement.id}`}>
                <small>
                  {source}, {when}
                  {announcement.is_important ? ' · Importante' : ''}
                </small>
                <strong>{announcement.title}</strong>
                {announcement.summary && <small>{announcement.summary}</small>}
              </Link>
              {announcement.is_important && <Pill tone="alert">Importante</Pill>}
            </Row>
          )
        })}
      </RowList>
      <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
        Toutes les annonces
      </ButtonRouteLink>
    </>
  )
}
