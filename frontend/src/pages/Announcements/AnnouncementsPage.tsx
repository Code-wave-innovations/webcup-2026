import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ANNOUNCEMENT_CATEGORIES, announcementCategoryLabel, useAnnouncements } from '../../api/announcements'
import { messageFor } from '../../api/errors'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { formatPublished } from '../../lib/format'
import { Pill } from '../../ui/Badges'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import { RowLink, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Announcements.module.css'

const PAGE_SIZE = 10

const messages = defineMessages(
  {
    title: 'Annonces municipales',
    lead: 'Les publications de la ville : actualités, changements de service, informations pratiques et événements.',
    search: 'Rechercher une annonce',
    placeholder: 'Titre ou mot-clé',
    category: 'Catégorie',
    all: 'Toutes',
    loading: 'Chargement des annonces…',
    empty: 'Aucune annonce ne correspond à cette recherche.',
    important: 'Importante',
    pages: 'Pages',
    previous: 'Précédente',
    next: 'Suivante',
    pageOf: (page: number, pages: number) => `Page ${page} sur ${pages}`,
    back: 'Retour à l’accueil',
  },
  {
    title: 'Municipal announcements',
    lead: 'City publications: news, service changes, practical information and events.',
    search: 'Search an announcement',
    placeholder: 'Title or keyword',
    category: 'Category',
    all: 'All',
    loading: 'Loading announcements…',
    empty: 'No announcement matches this search.',
    important: 'Important',
    pages: 'Pages',
    previous: 'Previous',
    next: 'Next',
    pageOf: (page, pages) => `Page ${page} of ${pages}`,
    back: 'Back to home',
  },
)

/** D06: every published announcement, filterable by category. */
export default function AnnouncementsPage() {
  const [params, setParams] = useSearchParams()
  const category = ANNOUNCEMENT_CATEGORIES.find((value) => value === params.get('categorie'))
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(q)
  const m = useMessages(messages)
  const locale = useLocale()

  const update = (changes: Record<string, string | null>, keepPage = false) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!keepPage) next.delete('page')
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300)
    return () => clearTimeout(timer)
    // the typed text is the only trigger; update is recreated every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const list = useAnnouncements({ category, q: q || undefined, page, limit: PAGE_SIZE })
  const items = list.data?.data ?? []
  const meta = list.data?.meta

  return (
    <ConsolePage title={m.title} lead={m.lead}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Field label={m.search} htmlFor="annonce-q">
            <input id="annonce-q" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={m.placeholder} />
          </Field>
        </div>
        <fieldset className={styles.chips}>
          <legend className={text.note}>{m.category}</legend>
          <button type="button" aria-pressed={!category} onClick={() => update({ categorie: null })}>
            {m.all}
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((value) => (
            <button key={value} type="button" aria-pressed={category === value} onClick={() => update({ categorie: value })}>
              {announcementCategoryLabel(value, locale)}
            </button>
          ))}
        </fieldset>
      </div>

      {list.isError && <p className={text.error}>{messageFor(list.error)}</p>}
      {list.isPending && !list.data && <p className={text.note}>{m.loading}</p>}
      {list.data && items.length === 0 && (
        <GlassPanel>
          <p>{m.empty}</p>
        </GlassPanel>
      )}
      {items.length > 0 && (
        <RowList className={styles.list}>
          {items.map((announcement) => (
            <RowLink key={announcement.id} to={`/ville/annonces/${announcement.id}`}>
              <span className={styles.rowTitle}>
                <span>
                  <small>
                    {announcementCategoryLabel(announcement.category, locale)}
                    {announcement.published_at ? ` · ${formatPublished(announcement.published_at, locale)}` : ''}
                    {announcement.service ? ` · ${announcement.service.name}` : ''}
                  </small>
                  <strong>{announcement.title}</strong>
                  {announcement.summary && <small>{announcement.summary}</small>}
                </span>
                {announcement.is_important && <Pill tone="alert">{m.important}</Pill>}
              </span>
            </RowLink>
          ))}
        </RowList>
      )}
      {meta && meta.pages > 1 && (
        <nav className={styles.pages} aria-label={m.pages}>
          <Button small disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
            {m.previous}
          </Button>
          <span aria-current="page">{m.pageOf(meta.page, meta.pages)}</span>
          <Button small disabled={page >= meta.pages} onClick={() => update({ page: String(page + 1) }, true)}>
            {m.next}
          </Button>
        </nav>
      )}
      <div>
        <ButtonRouteLink to="/ville" variant="ghost" small>
          {m.back}
        </ButtonRouteLink>
      </div>
    </ConsolePage>
  )
}
