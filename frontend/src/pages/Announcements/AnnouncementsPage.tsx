import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ANNOUNCEMENT_CATEGORIES, announcementCategoryLabel, useAnnouncements } from '../../api/announcements'
import { messageFor } from '../../api/errors'
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

/** D06: every published announcement, filterable by category. */
export default function AnnouncementsPage() {
  const [params, setParams] = useSearchParams()
  const category = ANNOUNCEMENT_CATEGORIES.find((value) => value === params.get('categorie'))
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(q)

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
    <ConsolePage
      title="Annonces municipales"
      lead="Les publications de la ville : actualités, changements de service, informations pratiques et événements."
    >
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Field label="Rechercher une annonce" htmlFor="annonce-q">
            <input id="annonce-q" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titre ou mot-clé" />
          </Field>
        </div>
        <fieldset className={styles.chips}>
          <legend className={text.note}>Catégorie</legend>
          <button type="button" aria-pressed={!category} onClick={() => update({ categorie: null })}>
            Toutes
          </button>
          {ANNOUNCEMENT_CATEGORIES.map((value) => (
            <button key={value} type="button" aria-pressed={category === value} onClick={() => update({ categorie: value })}>
              {announcementCategoryLabel(value)}
            </button>
          ))}
        </fieldset>
      </div>

      {list.isError && <p className={text.error}>{messageFor(list.error)}</p>}
      {list.isPending && !list.data && <p className={text.note}>Chargement des annonces…</p>}
      {list.data && items.length === 0 && (
        <GlassPanel>
          <p>Aucune annonce ne correspond à cette recherche.</p>
        </GlassPanel>
      )}
      {items.length > 0 && (
        <RowList className={styles.list}>
          {items.map((announcement) => (
            <RowLink key={announcement.id} to={`/ville/annonces/${announcement.id}`}>
              <span className={styles.rowTitle}>
                <span>
                  <small>
                    {announcementCategoryLabel(announcement.category)}
                    {announcement.published_at ? ` · ${formatPublished(announcement.published_at)}` : ''}
                    {announcement.service ? ` · ${announcement.service.name}` : ''}
                  </small>
                  <strong>{announcement.title}</strong>
                  {announcement.summary && <small>{announcement.summary}</small>}
                </span>
                {announcement.is_important && <Pill tone="alert">Importante</Pill>}
              </span>
            </RowLink>
          ))}
        </RowList>
      )}
      {meta && meta.pages > 1 && (
        <nav className={styles.pages} aria-label="Pages">
          <Button small disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
            Précédente
          </Button>
          <span aria-current="page">
            Page {meta.page} sur {meta.pages}
          </span>
          <Button small disabled={page >= meta.pages} onClick={() => update({ page: String(page + 1) }, true)}>
            Suivante
          </Button>
        </nav>
      )}
      <div>
        <ButtonRouteLink to="/ville" variant="ghost" small>
          Retour à l’accueil
        </ButtonRouteLink>
      </div>
    </ConsolePage>
  )
}
