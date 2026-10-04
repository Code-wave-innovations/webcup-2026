import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { messageFor } from '../../../api/errors'
import { useRequests } from '../../../api/requests'
import { useCitizens } from '../../../api/users'
import { formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { RequestTable } from '../../shared/RequestTable'
import { AccountDrawer } from '../../shared/AccountDrawer'
import { CitizenCard } from '../../shared/CitizenCard'
import { Flag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { SearchInput } from '../../ui/Controls'
import { Avatar, EmptyState, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

/** F34: look up a citizen and see only what is needed to process their requests. */
export default function CitizensPage() {
  const now = useNow()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // ?compte=<id>: the account drawer (also reached from the audit log)
  const [params, setParams] = useSearchParams()
  const openId = Number(params.get('compte')) || null
  const openAccount = (id: number | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('compte', String(id))
        else next.delete('compte')
        return next
      },
      { replace: true },
    )

  // The directory is searched on the server once typing pauses
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const directory = useCitizens(search)
  const citizens = directory.data?.data ?? []
  const selected = citizens.find((c) => c.id === selectedId) ?? citizens[0]
  const theirRequests = useRequests({ citizen_id: selected?.id, limit: 20, sort: 'newest' }, selected !== undefined)

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Citoyens"
        codes={['F34']}
        lead="Consultation des informations nécessaires au traitement. Les identifiants et mots de passe ne sont jamais accessibles aux agents."
      />

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel
          kicker="Annuaire"
          title={directory.data ? `${directory.data.meta.total} citoyen${directory.data.meta.total > 1 ? 's' : ''}` : 'Citoyens'}
          flush
          aria-busy={directory.isFetching}
        >
          <div className={layout.toolbar}>
            <SearchInput label="Nom, e-mail… (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {!directory.data ? (
            directory.isError ? <EmptyState title={messageFor(directory.error)} icon="alert" /> : <Skeleton lines={6} />
          ) : citizens.length === 0 ? (
            <EmptyState title="Aucun citoyen trouvé" icon="users" />
          ) : (
            <ul className={styles.citizenList}>
              {citizens.map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.citizenItem} aria-pressed={selected?.id === c.id} onClick={() => setSelectedId(c.id)}>
                    <Avatar name={c.name} lastName={c.last_name} size={34} tone={c.is_active ? 'ice' : 'neutral'} />
                    <span>
                      {c.name} {c.last_name}
                      <small>
                        {c.district?.name ?? 'Quartier non renseigné'} · {c.last_login_at ? `vu·e ${formatRelative(c.last_login_at, now)}` : 'jamais connecté·e'}
                      </small>
                    </span>
                    <span className={layout.row}>
                      {c.login_locked && <Flag icon="lock" tone="alert">Verrouillé</Flag>}
                      {!c.is_active && <Flag icon="lock" tone="alert">Désactivé</Flag>}
                      {c.is_vulnerable && <Flag icon="alert" tone="progress">Vulnérable</Flag>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {selected && (
          <Panel
            kicker="Fiche"
            title={`${selected.name} ${selected.last_name}`}
            accent="ice"
            actions={
              <Button size="sm" icon="edit" onClick={() => openAccount(selected.id)}>
                Gérer le compte
              </Button>
            }
          >
            <CitizenCard citizen={selected} requests={theirRequests.data?.meta.total} />
          </Panel>
        )}
      </div>

      {selected && (
        <Panel kicker="F26" title={`Demandes de ${selected.name} ${selected.last_name}`} flush>
          {theirRequests.data ? (
            <RequestTable requests={theirRequests.data.data} caption={`Demandes de ${selected.name} ${selected.last_name}`} />
          ) : (
            <Skeleton lines={4} />
          )}
        </Panel>
      )}

      <AccountDrawer userId={openId} onClose={() => openAccount(null)} />
    </motion.div>
  )
}
