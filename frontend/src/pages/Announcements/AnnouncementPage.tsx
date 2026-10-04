import { useParams } from 'react-router'
import { announcementCategoryLabel, useAnnouncement } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { formatPublished } from '../../lib/format'
import { Pill } from '../../ui/Badges'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Announcements.module.css'

const messages = defineMessages(
  {
    crumb: 'Annonces',
    loadingTitle: 'Annonce',
    loadingLead: 'Chargement…',
    loadingBody: 'Lecture de la publication…',
    missingTitle: 'Annonce introuvable',
    missingLead: 'Cette publication n’existe plus ou n’est pas encore visible.',
    important: 'Importante',
    all: 'Toutes les annonces',
  },
  {
    crumb: 'Announcements',
    loadingTitle: 'Announcement',
    loadingLead: 'Loading…',
    loadingBody: 'Reading the publication…',
    missingTitle: 'Announcement not found',
    missingLead: 'This publication no longer exists or is not visible yet.',
    important: 'Important',
    all: 'All announcements',
  },
)

const paragraphsOf = (content: string) =>
  content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

/** D06: the full text of one publication. Never rendered as HTML. */
export default function AnnouncementPage() {
  const raw = Number(useParams().id)
  const id = Number.isInteger(raw) && raw > 0 ? raw : undefined
  const query = useAnnouncement(id)
  const announcement = query.data
  const m = useMessages(messages)
  const locale = useLocale()
  const crumbs = [{ label: m.crumb, to: '/ville/annonces' }]

  if (query.isPending) {
    return (
      <ConsolePage title={m.loadingTitle} crumbs={crumbs} lead={m.loadingLead}>
        <p className={text.note}>{m.loadingBody}</p>
      </ConsolePage>
    )
  }

  if (!announcement) {
    return (
      <ConsolePage title={m.missingTitle} crumbs={crumbs} lead={m.missingLead}>
        <GlassPanel>
          {query.isError && <p className={text.error}>{messageFor(query.error)}</p>}
          <ButtonRouteLink to="/ville/annonces">{m.all}</ButtonRouteLink>
        </GlassPanel>
      </ConsolePage>
    )
  }

  return (
    <ConsolePage title={announcement.title} crumbs={crumbs}>
      <p className={styles.meta}>
        <span>{announcementCategoryLabel(announcement.category, locale)}</span>
        {announcement.published_at && <time dateTime={announcement.published_at}>{formatPublished(announcement.published_at, locale)}</time>}
        {announcement.service && <span>{announcement.service.name}</span>}
        {announcement.is_important && <Pill tone="alert">{m.important}</Pill>}
      </p>
      <GlassPanel className={styles.article}>
        {announcement.summary && <p>{announcement.summary}</p>}
        {paragraphsOf(announcement.content).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </GlassPanel>
      <div>
        <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
          {m.all}
        </ButtonRouteLink>
      </div>
    </ConsolePage>
  )
}
