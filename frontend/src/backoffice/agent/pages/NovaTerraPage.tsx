import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { messageFor, toApiError } from '../../../api/errors'
import { useRefreshTerraNova, useTerraNovaFeed } from '../../../api/terraNova'
import { formatCountdown, formatTime } from '../../lib/format'
import { readPref, writePref } from '../../lib/storage'
import { byRecency, nextWaveAt } from '../../lib/terraNova'
import { useNow } from '../../lib/useNow'
import { TerraNovaCard } from '../../shared/TerraNovaCard'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput, Select } from '../../ui/Controls'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { AnimatedNumber } from '../../ui/StatTile'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

const WAVE_MINUTES = 60
const LAST_WAVE_KEY = 'bo-nova-terra-last-wave'
const GLOW_MS = 5000

/** What went wrong, said for the people who run the platform. */
function feedError(error: unknown, lastUpdate?: string): string {
  const apiError = toApiError(error)
  if (apiError.status === 503) return 'Flux Nova Terra non configuré (clé manquante côté serveur).'
  if (apiError.status === 502)
    return lastUpdate
      ? `Flux Nova Terra indisponible : dernière mise à jour à ${formatTime(lastUpdate)}.`
      : 'Flux Nova Terra indisponible : l’API officielle ne répond pas.'
  return messageFor(error)
}

/** D19: the official Terra Nova API feed (GET /api/terra-nova/requests), as agents see it. */
export default function NovaTerraPage() {
  const now = useNow()
  const feedQuery = useTerraNovaFeed()
  const refresh = useRefreshTerraNova()
  const feed = feedQuery.data
  const requests = feed?.data.requests ?? []
  const session = feed?.data.session
  const wave = session?.current_wave

  const [group, setGroup] = useState('all')
  const [difficulty, setDifficulty] = useState('')
  const [waveFilter, setWaveFilter] = useState('')
  const [kind, setKind] = useState('')
  const [query, setQuery] = useState('')
  const [onlyUnseen, setOnlyUnseen] = useState(false)

  // Last wave seen on a previous visit: read once, then the current wave is remembered
  const [lastVisitWave] = useState(() => {
    const stored = Number(readPref(LAST_WAVE_KEY))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  })
  useEffect(() => {
    if (wave !== undefined) writePref(LAST_WAVE_KEY, String(wave))
  }, [wave])

  // A new wave while the page is open: toast and brief glow of its cards
  const [knownWave, setKnownWave] = useState(wave)
  const [glowWave, setGlowWave] = useState<number | null>(null)
  if (wave !== knownWave) {
    if (wave !== undefined && knownWave !== undefined && wave > knownWave) setGlowWave(wave)
    setKnownWave(wave)
  }
  const glowCount = glowWave === null ? 0 : requests.filter((r) => r.wave_number === glowWave).length
  useEffect(() => {
    if (glowWave === null) return
    toast(`Nouvelle vague ${glowWave} : ${glowCount} demande${glowCount > 1 ? 's' : ''}`, 'info')
    const timer = setTimeout(() => setGlowWave(null), GLOW_MS)
    return () => clearTimeout(timer)
  }, [glowWave, glowCount])

  const header = (
    <PageHeader
      title="API Nova Terra"
      codes={['D19']}
      lead="Les besoins exprimés par les habitants et le Haut Conseil via l’API officielle. Mise en cache 60 s côté serveur."
      actions={
        <Button
          icon="swap"
          disabled={refresh.isPending}
          aria-busy={refresh.isPending}
          onClick={() =>
            refresh.mutate(undefined, {
              onSuccess: () => toast('Flux Nova Terra actualisé', 'info'),
              onError: (error) => toast(feedError(error, feed?.fetched_at), 'alert'),
            })
          }
        >
          {refresh.isPending ? 'Actualisation…' : 'Actualiser'}
        </Button>
      }
    />
  )

  if (!feed || !session) {
    return (
      <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
        {header}
        <Panel title="Flux Nova Terra" accent={feedQuery.isError ? 'alert' : 'ice'}>
          {feedQuery.isError ? (
            <EmptyState title={feedError(feedQuery.error)} icon="satellite" />
          ) : (
            <Skeleton lines={5} />
          )}
        </Panel>
      </motion.div>
    )
  }

  const running = session.is_running !== false
  const remaining = Math.max(0, nextWaveAt(feed) - now)
  const ratio = Math.min(1, Math.max(0, 1 - remaining / (WAVE_MINUTES * 60_000)))
  const countdown = formatCountdown(remaining)
  const isUnseen = (waveNumber: number | null) => lastVisitWave !== null && waveNumber !== null && waveNumber > lastVisitWave
  const unseenCount = requests.filter((r) => isUnseen(r.wave_number)).length

  const groups = [...new Set(requests.map((r) => r.group_name))]
  const difficulties = [...new Map(requests.map((r) => [r.difficulty, r.difficulty_level])).entries()].sort((a, b) => a[1] - b[1]).map(([d]) => d)
  const waves = [...new Set(requests.map((r) => r.wave_number).filter((w): w is number => w !== null))].sort((a, b) => a - b)
  const kinds = [...new Set(requests.map((r) => r.requester_type))]
  const q = query.trim().toLowerCase()
  const filtered = requests
    .filter((r) => group === 'all' || r.group_name === group)
    .filter((r) => !difficulty || r.difficulty === difficulty)
    .filter((r) => !waveFilter || (waveFilter === 'socle' ? r.wave_number === null : r.wave_number === Number(waveFilter)))
    .filter((r) => !kind || r.requester_type === kind)
    .filter((r) => !onlyUnseen || isUnseen(r.wave_number))
    .filter((r) => !q || `${r.request_code} ${r.requester_name} ${r.message_public}`.toLowerCase().includes(q))
    .sort(byRecency)
  const xp = requests.reduce((sum, r) => sum + r.xp_total, 0)
  const ring = 2 * Math.PI * 56
  const filterKey = [group, difficulty, waveFilter, kind, onlyUnseen, q].join('-')

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      {header}

      {feedQuery.isError && (
        <p className={styles.feedWarning} role="status">
          {feedError(feedQuery.error, feed.fetched_at)} Les dernières données restent affichées.
        </p>
      )}

      <Panel
        kicker={running ? 'Session en cours' : 'Session terminée'}
        title={`Vague ${session.current_wave}${running ? ' en cours' : ''}`}
        accent="ice"
        actions={<LiveDot label={`Synchronisé à ${formatTime(feed.fetched_at)}`} />}
      >
        <div className={styles.waveHero}>
          {running && (
            <div className={styles.ring} role="img" aria-label={`Vague ${session.next_wave_number} dans ${countdown}`}>
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
          )}
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
        <Select aria-label="Difficulté" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Toutes les difficultés</option>
          {difficulties.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select aria-label="Vague" value={waveFilter} onChange={(e) => setWaveFilter(e.target.value)}>
          <option value="">Toutes les vagues</option>
          <option value="socle">Socle (dès le début)</option>
          {waves.map((w) => (
            <option key={w} value={w}>
              Vague {w}
            </option>
          ))}
        </Select>
        <Select aria-label="Type de demandeur" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Tous les demandeurs</option>
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
        <Button variant={onlyUnseen ? 'primary' : 'ghost'} aria-pressed={onlyUnseen} disabled={unseenCount === 0 && !onlyUnseen} onClick={() => setOnlyUnseen(!onlyUnseen)}>
          Nouvelles depuis ma dernière visite ({unseenCount})
        </Button>
      </div>

      <p className="bo-sr-only" role="status">
        {filtered.length} demande{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
      </p>
      {filtered.length === 0 ? (
        <EmptyState title="Aucune demande ne correspond à ces filtres" icon="satellite" />
      ) : (
        <motion.div className={styles.feedGrid} variants={stagger} initial="hidden" animate="show" key={filterKey}>
          {filtered.map((r) => (
            <TerraNovaCard key={r.id} request={r} glow={glowWave !== null && r.wave_number === glowWave} unseen={isUnseen(r.wave_number)} />
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
