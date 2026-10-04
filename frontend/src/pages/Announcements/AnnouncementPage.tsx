import { useParams } from 'react-router'
import { ANNOUNCEMENT_CATEGORY_LABEL, useAnnouncement } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { formatPublished } from '../../lib/format'
import { Pill } from '../../ui/Badges'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Announcements.module.css'

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

  if (query.isPending) {
    return (
      <ConsolePage title="Annonce" crumbs={[{ label: 'Annonces', to: '/ville/annonces' }]} lead="Chargement…">
        <p className={text.note}>Lecture de la publication…</p>
      </ConsolePage>
    )
  }

  if (!announcement) {
    return (
      <ConsolePage title="Annonce introuvable" crumbs={[{ label: 'Annonces', to: '/ville/annonces' }]} lead="Cette publication n’existe plus ou n’est pas encore visible.">
        <GlassPanel>
          {query.isError && <p className={text.error}>{messageFor(query.error)}</p>}
          <ButtonRouteLink to="/ville/annonces">Toutes les annonces</ButtonRouteLink>
        </GlassPanel>
      </ConsolePage>
    )
  }

  return (
    <ConsolePage title={announcement.title} crumbs={[{ label: 'Annonces', to: '/ville/annonces' }]}>
      <p className={styles.meta}>
        <span>{ANNOUNCEMENT_CATEGORY_LABEL[announcement.category]}</span>
        {announcement.published_at && <time dateTime={announcement.published_at}>{formatPublished(announcement.published_at)}</time>}
        {announcement.service && <span>{announcement.service.name}</span>}
        {announcement.is_important && <Pill tone="alert">Importante</Pill>}
      </p>
      <GlassPanel className={styles.article}>
        {announcement.summary && <p>{announcement.summary}</p>}
        {paragraphsOf(announcement.content).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </GlassPanel>
      <div>
        <ButtonRouteLink to="/ville/annonces" variant="ghost" small>
          Toutes les annonces
        </ButtonRouteLink>
      </div>
    </ConsolePage>
  )
}
