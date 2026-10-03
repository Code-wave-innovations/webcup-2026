import { messageFor, toApiError } from '../../api/errors'
import { useTerraNovaFeed } from '../../api/terraNova'
import { formatCountdown } from '../lib/format'
import { byRecency, nextWaveAt } from '../lib/terraNova'
import { useNow } from '../lib/useNow'
import { ButtonLink } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/Feedback'
import { Panel } from '../ui/Panel'
import layout from '../ui/layout.module.css'
import styles from '../agent/pages/agent.module.css'
import { TerraNovaCard } from './TerraNovaCard'

/** D19: the Terra Nova box of the agent dashboard: wave, countdown, the 3 latest requests. */
export function TerraNovaGlance() {
  const now = useNow()
  const { data: feed, error, isError } = useTerraNovaFeed()
  const session = feed?.data.session

  return (
    <Panel
      kicker="D19 · API officielle"
      title={session ? `Nova Terra — vague ${session.current_wave}` : 'Nova Terra'}
      accent="ice"
      actions={
        <ButtonLink to="/agent/nova-terra" size="sm" variant="ghost" icon="satellite">
          Flux complet
        </ButtonLink>
      }
    >
      {!feed || !session ? (
        isError ? (
          <EmptyState
            title={toApiError(error).status === 503 ? 'Flux Nova Terra non configuré (clé manquante côté serveur).' : messageFor(error)}
            icon="satellite"
          />
        ) : (
          <Skeleton lines={4} />
        )
      ) : (
        <>
          <div className={styles.wave}>
            {session.is_running !== false && (
              <div>
                <p className={layout.sectionLabel}>Vague {session.next_wave_number} dans</p>
                <p className={styles.countdown} aria-live="off">
                  {formatCountdown(nextWaveAt(feed) - now)}
                </p>
              </div>
            )}
            <div>
              <p className={layout.sectionLabel}>Demandes visibles</p>
              <p className={styles.countdown}>{session.visible_requests_count}</p>
            </div>
          </div>
          <div className={layout.stack}>
            {[...feed.data.requests].sort(byRecency).slice(0, 3).map((r) => (
              <TerraNovaCard key={r.id} request={r} />
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
