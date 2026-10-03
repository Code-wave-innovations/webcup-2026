import { useState } from 'react'
import { motion } from 'motion/react'
import { formatRelative } from '../../lib/format'
import { districtName } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import { RequestTable } from '../../shared/RequestTable'
import { CitizenCard } from '../../shared/CitizenCard'
import { useAppointmentStore } from '../../stores/appointmentStore'
import { useRequestStore } from '../../stores/requestStore'
import { useUserStore } from '../../stores/userStore'
import { Flag } from '../../ui/Badges'
import { SearchInput } from '../../ui/Controls'
import { Avatar, EmptyState } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

/** F34: look up a citizen and see only what is needed to process their requests. */
export default function CitizensPage() {
  const now = useNow()
  const users = useUserStore((s) => s.users)
  const requests = useRequestStore((s) => s.requests)
  const appointments = useAppointmentStore((s) => s.appointments)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const q = query.trim().toLowerCase()
  const citizens = users
    .filter((u) => u.role === 'CITIZEN')
    .filter((u) => !q || `${u.name} ${u.last_name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(q))
  const selected = citizens.find((c) => c.id === selectedId) ?? citizens[0]
  const theirRequests = selected ? requests.filter((r) => r.citizen_id === selected.id) : []

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Citoyens"
        codes={['F34']}
        lead="Consultation des informations nécessaires au traitement. Les identifiants et mots de passe ne sont jamais accessibles aux agents."
      />

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="Annuaire" title={`${citizens.length} citoyen${citizens.length > 1 ? 's' : ''}`} flush>
          <div className={layout.toolbar}>
            <SearchInput label="Nom, e-mail, téléphone… (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {citizens.length === 0 ? (
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
                        {districtName(c.district_id)} · {c.last_login_at ? `vu·e ${formatRelative(c.last_login_at, now)}` : 'jamais connecté·e'}
                      </small>
                    </span>
                    <span className={layout.row}>
                      {c.is_vulnerable && <Flag icon="alert" tone="progress">Vulnérable</Flag>}
                      {c.login_locked && <Flag icon="lock" tone="alert">Verrouillé</Flag>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {selected && (
          <Panel kicker="Fiche" title={`${selected.name} ${selected.last_name}`} accent="ice">
            <CitizenCard
              citizen={selected}
              requests={theirRequests.length}
              appointments={appointments.filter((a) => a.citizen_id === selected.id).length}
            />
          </Panel>
        )}
      </div>

      {selected && (
        <Panel kicker="F26" title={`Demandes de ${selected.name} ${selected.last_name}`} flush>
          <RequestTable requests={theirRequests} caption={`Demandes de ${selected.name} ${selected.last_name}`} />
        </Panel>
      )}
    </motion.div>
  )
}
