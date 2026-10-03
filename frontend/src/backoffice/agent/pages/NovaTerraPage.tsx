import { useState } from 'react'
import { motion } from 'motion/react'
import { useNow } from '../../lib/useNow'
import { TERRA_NOVA_FEED } from '../../mocks/terraNova'
import { LOADED_AT } from '../../mocks/time'
import { TerraNovaCard } from '../../shared/TerraNovaCard'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput, Select } from '../../ui/Controls'
import { EmptyState, LiveDot } from '../../ui/Feedback'
import { AnimatedNumber } from '../../ui/StatTile'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

const WAVE_MINUTES = 60

/** D19: the official Terra Nova API feed (GET /api/terra-nova/requests), as agents see it. */
export default function NovaTerraPage() {
  const now = useNow()
  const { session, requests } = TERRA_NOVA_FEED
  const [group, setGroup] = useState('all')
  const [kind, setKind] = useState('')
  const [query, setQuery] = useState('')
  const [syncedAt, setSyncedAt] = useState(LOADED_AT)

  const nextWaveAt = LOADED_AT + session.minutes_until_next_wave * 60_000
  const remaining = Math.max(0, nextWaveAt - now)
  const ratio = 1 - remaining / (WAVE_MINUTES * 60_000)
  const countdown = `${String(Math.floor(remaining / 60_000)).padStart(2, '0')}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')}`
  const groups = [...new Set(requests.map((r) => r.group_name))]
  const kinds = [...new Set(requests.map((r) => r.requester_type))]
  const q = query.trim().toLowerCase()
  const filtered = requests
    .filter((r) => group === 'all' || r.group_name === group)
    .filter((r) => !kind || r.requester_type === kind)
    .filter((r) => !q || `${r.request_code} ${r.requester_name} ${r.message_public}`.toLowerCase().includes(q))
    .sort((a, b) => (b.wave_number ?? 0) - (a.wave_number ?? 0) || a.id - b.id)
  const xp = requests.reduce((sum, r) => sum + r.xp_total, 0)
  const ring = 2 * Math.PI * 56

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="API Nova Terra"
        codes={['D19']}
        lead="Les besoins exprimés par les habitants et le Haut Conseil via l’API officielle. Mise en cache 60 s côté serveur."
        actions={
          <Button
            icon="swap"
            onClick={() => {
              setSyncedAt(Date.now())
              toast('Flux Nova Terra synchronisé', 'info')
            }}
          >
            Actualiser
          </Button>
        }
      />

      <Panel kicker={`Session ${session.status}`} title={`Vague ${session.current_wave} en cours`} accent="ice" actions={<LiveDot label={`Synchronisé à ${new Date(syncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`} />}>
        <div className={styles.waveHero}>
          <div className={styles.ring} role="img" aria-label={`Prochaine vague dans ${countdown}`}>
            <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">
              <circle cx="66" cy="66" r="56" fill="none" stroke="var(--color-line-thin)" strokeWidth="6" />
              <circle
                cx="66"
                cy="66"
                r="56"
                fill="none"
                stroke="var(--color-ember)"
                strokeWidth="6"
                strokeDasharray={`${ring} ${ring}`}
                strokeDashoffset={ring * (1 - ratio)}
                transform="rotate(-90 66 66)"
                style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px var(--color-ember))' }}
              />
            </svg>
            <span className={styles.ringText}>
              <strong>{countdown}</strong>
              <small>vague {session.next_wave_number}</small>
            </span>
          </div>
          <div>
            <p className={layout.sectionLabel}>Demandes visibles</p>
            <p className={styles.countdown}>
              <AnimatedNumber value={session.visible_requests_count} />
            </p>
          </div>
          <div>
            <p className={layout.sectionLabel}>Temps écoulé</p>
            <p className={styles.countdown}>
              {Math.floor(session.elapsed_minutes / 60)} h {String(session.elapsed_minutes % 60).padStart(2, '0')}
            </p>
          </div>
          <div>
            <p className={layout.sectionLabel}>XP disponibles</p>
            <p className={styles.countdown}>
              <AnimatedNumber value={xp} />
            </p>
          </div>
        </div>
      </Panel>

      <div className={layout.row}>
        <FilterChips<string>
          label="Groupe"
          value={group}
          onChange={setGroup}
          options={[{ value: 'all', label: 'Tous', count: requests.length }, ...groups.map((g) => ({ value: g, label: g, count: requests.filter((r) => r.group_name === g).length }))]}
        />
      </div>
      <div className={layout.toolbar} style={{ padding: 0 }}>
        <SearchInput label="Code, demandeur, contenu… (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select aria-label="Type de demandeur" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Tous les demandeurs</option>
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucune demande" icon="satellite" />
      ) : (
        <motion.div className={styles.feedGrid} variants={stagger} initial="hidden" animate="show" key={`${group}-${kind}-${q}`}>
          {filtered.map((r) => (
            <TerraNovaCard key={r.id} request={r} fresh={r.wave_number === session.current_wave} />
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
