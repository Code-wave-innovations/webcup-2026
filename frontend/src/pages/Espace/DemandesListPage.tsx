import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { messageFor } from '../../api/errors'
import { useRequests, type RequestFilters } from '../../api/requests'
import { friseTone, requestStatusMessages } from '../../api/requestStatus'
import { defineMessages, useMessages } from '../../i18n'
import { formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import { espaceMessages } from './espace.messages'
import styles from './Espace.module.css'

type Tab = 'en-cours' | 'a-completer' | 'terminees' | 'toutes'

const TABS: Tab[] = ['en-cours', 'a-completer', 'terminees', 'toutes']

const messages = defineMessages(
  {
    tabs: {
      'en-cours': 'En cours',
      'a-completer': 'À compléter',
      terminees: 'Terminées',
      toutes: 'Toutes',
    } satisfies Record<Tab, string>,
    lead: 'Suivez l’état de vos messages, démarches et signalements sans contacter la mairie.',
    tabsLabel: 'Filtres des demandes',
    searchPlaceholder: 'Rechercher (référence, objet…)',
    searchLabel: 'Rechercher dans mes demandes',
    search: 'Rechercher',
    empty: 'Aucune demande pour ce filtre.',
    backHome: 'Retour à l’accueil',
    previous: 'Précédent',
    next: 'Suivant',
    page: (page: number, pages: number) => `Page ${page} / ${pages}`,
  },
  {
    tabs: {
      'en-cours': 'In progress',
      'a-completer': 'Action needed',
      terminees: 'Finished',
      toutes: 'All',
    },
    lead: 'Follow your messages, procedures and reports without having to contact the city hall.',
    tabsLabel: 'Request filters',
    searchPlaceholder: 'Search (reference, subject…)',
    searchLabel: 'Search my requests',
    search: 'Search',
    empty: 'No requests for this filter.',
    backHome: 'Back to home',
    previous: 'Previous',
    next: 'Next',
    page: (page, pages) => `Page ${page} of ${pages}`,
  },
)

function parseTab(value: string | null): Tab {
  if (value === 'a-completer' || value === 'terminees' || value === 'toutes' || value === 'en-cours') return value
  return 'en-cours'
}

function filtersFor(tab: Tab, q: string, page: number): RequestFilters {
  const base: RequestFilters = { q: q || undefined, page, limit: 10, sort: 'updated' }
  if (tab === 'en-cours') return { ...base, scope: 'open' }
  if (tab === 'a-completer') return { ...base, status: ['WAITING_CITIZEN'] }
  if (tab === 'terminees') return { ...base, scope: 'closed' }
  return base
}

/** D11 / F26: citizen request list with tabs and search. */
export default function DemandesListPage() {
  const now = useNow()
  const m = useMessages(messages)
  const common = useMessages(espaceMessages)
  const labels = useMessages(requestStatusMessages)
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get('onglet'))
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page') || 1) || 1)
  const [draft, setDraft] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    setDraft(q)
  }
  const waitingMeta = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 })
  const list = useRequests(filtersFor(tab, q, page))

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('onglet', next)
    nextParams.delete('page')
    setParams(nextParams)
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const nextParams = new URLSearchParams(params)
    if (draft.trim()) nextParams.set('q', draft.trim())
    else nextParams.delete('q')
    nextParams.delete('page')
    setParams(nextParams)
  }

  const goPage = (next: number) => {
    const nextParams = new URLSearchParams(params)
    if (next <= 1) nextParams.delete('page')
    else nextParams.set('page', String(next))
    setParams(nextParams)
  }

  const waitingCount = waitingMeta.data?.meta.total ?? 0

  return (
    <ConsolePage
      title={common.requests}
      crumbs={[{ label: common.espace, to: '/ville/espace' }]}
      lead={m.lead}
    >
      <div role="tablist" aria-label={m.tabsLabel} className={styles.tabs}>
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {m.tabs[item]}
            {item === 'a-completer' && waitingCount > 0 && <span className={styles.tabCount}>{waitingCount}</span>}
          </button>
        ))}
      </div>

      <form className={styles.searchRow} onSubmit={submitSearch}>
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={m.searchPlaceholder}
          aria-label={m.searchLabel}
        />
        <Button type="submit" small variant="ghost">
          {m.search}
        </Button>
      </form>

      {list.isPending && <p className={text.note}>{common.loading}</p>}
      {list.isError && (
        <p className={text.error}>
          {messageFor(list.error)}{' '}
          <button type="button" onClick={() => void list.refetch()}>
            {common.retry}
          </button>
        </p>
      )}

      {list.data && list.data.data.length === 0 && (
        <GlassPanel className={styles.card}>
          <p>{m.empty}</p>
          <div className={styles.cardActions}>
            <ButtonRouteLink to="/ville">{m.backHome}</ButtonRouteLink>
          </div>
        </GlassPanel>
      )}

      {list.data && list.data.data.length > 0 && (
        <>
          <ul className={styles.list}>
            {list.data.data.map((request) => (
              <li key={request.id}>
                <Link to={`/ville/espace/demandes/${request.id}`} className={styles.row}>
                  <div className={styles.rowMeta}>
                    <span>{labels.type[request.type]}</span>
                    <span className={styles.pill} data-tone={friseTone(request.status)}>
                      {labels.status[request.status]}
                    </span>
                    <span>{formatRelative(request.updated_at, now)}</span>
                  </div>
                  <p className={styles.rowTitle}>{request.subject}</p>
                  <div className={styles.rowMeta}>
                    <span>{request.reference}</span>
                    <span>{labels.hint[request.status]}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {list.data.meta.pages > 1 && (
            <div className={styles.pagination}>
              <Button type="button" small variant="ghost" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                {m.previous}
              </Button>
              <span className={text.note}>
                {m.page(list.data.meta.page, list.data.meta.pages)}
              </span>
              <Button
                type="button"
                small
                variant="ghost"
                disabled={page >= list.data.meta.pages}
                onClick={() => goPage(page + 1)}
              >
                {m.next}
              </Button>
            </div>
          )}
        </>
      )}
    </ConsolePage>
  )
}
