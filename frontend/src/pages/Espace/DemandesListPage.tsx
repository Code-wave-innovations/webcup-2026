import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { messageFor } from '../../api/errors'
import { useRequests, type RequestFilters } from '../../api/requests'
import { CITIZEN_STATUS_LABEL, TYPE_LABEL, friseTone, nextStepHint } from '../../api/requestStatus'
import { formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Espace.module.css'

type Tab = 'en-cours' | 'a-completer' | 'terminees' | 'toutes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'en-cours', label: 'En cours' },
  { id: 'a-completer', label: 'À compléter' },
  { id: 'terminees', label: 'Terminées' },
  { id: 'toutes', label: 'Toutes' },
]

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
      title="Mes demandes"
      crumbs={[{ label: 'Mon espace', to: '/ville/espace' }]}
      lead="Suivez l’état de vos messages, démarches et signalements sans contacter la mairie."
    >
      <div role="tablist" aria-label="Filtres des demandes" className={styles.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === 'a-completer' && waitingCount > 0 && <span className={styles.tabCount}>{waitingCount}</span>}
          </button>
        ))}
      </div>

      <form className={styles.searchRow} onSubmit={submitSearch}>
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Rechercher (référence, objet…)"
          aria-label="Rechercher dans mes demandes"
        />
        <Button type="submit" small variant="ghost">
          Rechercher
        </Button>
      </form>

      {list.isPending && <p className={text.note}>Chargement…</p>}
      {list.isError && (
        <p className={text.error}>
          {messageFor(list.error)}{' '}
          <button type="button" onClick={() => void list.refetch()}>
            Réessayer
          </button>
        </p>
      )}

      {list.data && list.data.data.length === 0 && (
        <GlassPanel className={styles.card}>
          <p>Aucune demande pour ce filtre.</p>
          <div className={styles.cardActions}>
            <ButtonRouteLink to="/ville">Retour à l’accueil</ButtonRouteLink>
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
                    <span>{TYPE_LABEL[request.type]}</span>
                    <span className={styles.pill} data-tone={friseTone(request.status)}>
                      {CITIZEN_STATUS_LABEL[request.status]}
                    </span>
                    <span>{formatRelative(request.updated_at, now)}</span>
                  </div>
                  <p className={styles.rowTitle}>{request.subject}</p>
                  <div className={styles.rowMeta}>
                    <span>{request.reference}</span>
                    <span>{nextStepHint(request.status)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {list.data.meta.pages > 1 && (
            <div className={styles.pagination}>
              <Button type="button" small variant="ghost" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                Précédent
              </Button>
              <span className={text.note}>
                Page {list.data.meta.page} / {list.data.meta.pages}
              </span>
              <Button
                type="button"
                small
                variant="ghost"
                disabled={page >= list.data.meta.pages}
                onClick={() => goPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </ConsolePage>
  )
}
