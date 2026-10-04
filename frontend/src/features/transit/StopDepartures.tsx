import type { UseQueryResult } from '@tanstack/react-query'
import { messageFor } from '../../api/errors'
import { TRANSIT_STATUS_LABEL } from '../../api/transit'
import type { TransitStopDetail } from '../../api/types'
import { Pill } from '../../ui/Badges'
import { GlassPanel } from '../../ui/GlassPanel'
import { Icon } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { LineBadge } from './LineBadge'
import { groupDepartures, STATUS_TONE, waitLabel } from './transitText'
import styles from './Transit.module.css'

interface StopDeparturesProps {
  query: UseQueryResult<TransitStopDetail>
  /** why this stop is shown: "Favori", "Arrêt recherché"… */
  tag?: string
  favorite?: { active: boolean; disabled: boolean; onToggle: () => void }
  onOpenLine: (code: string) => void
}

/**
 * F36: one stop and what a resident needs there, in one place: a warning for each disrupted line serving it,
 * then the next 3 departures by line and direction, in minutes and clock time.
 */
export function StopDepartures({ query, tag, favorite, onOpenLine }: StopDeparturesProps) {
  const stop = query.data
  if (!stop) {
    return (
      <GlassPanel aria-busy={query.isPending}>
        {query.isError ? <p className={text.error}>{messageFor(query.error)}</p> : <p className={text.note}>Chargement des départs…</p>}
      </GlassPanel>
    )
  }

  const affected = stop.lines.filter((line) => line.status !== 'NORMAL')
  const interrupted = new Set(affected.filter((line) => line.status === 'INTERRUPTED').map((line) => line.id))
  // a run ending here is an arrival, not a departure
  const groups = groupDepartures(stop.next_departures.filter((departure) => departure.direction !== stop.name))

  return (
    <GlassPanel className={styles.stop}>
      <div className={styles.stopHead}>
        <div>
          {tag && <small className={styles.kicker}>{tag}</small>}
          <h3>{stop.name}</h3>
          <small className={text.note}>
            {[stop.district?.name, stop.address].filter(Boolean).join(' · ')}
            {!stop.accessible && ' · accès non adapté aux fauteuils'}
          </small>
        </div>
        {favorite && (
          <button
            type="button"
            className={styles.star}
            aria-pressed={favorite.active}
            disabled={favorite.disabled}
            onClick={favorite.onToggle}
            aria-label={favorite.active ? `Retirer ${stop.name} de mes arrêts` : `Ajouter ${stop.name} à mes arrêts`}
          >
            <Icon name="star" />
          </button>
        )}
      </div>

      {affected.map((line) => (
        <div key={line.id} className={styles.warning} role="note">
          <div className={styles.disruptionHead}>
            <LineBadge line={line} />
            <Pill tone={STATUS_TONE[line.status]}>{TRANSIT_STATUS_LABEL[line.status]}</Pill>
          </div>
          {line.status_message && <p className={styles.message}>{line.status_message}</p>}
        </div>
      ))}

      {groups.length === 0 ? (
        <div className={styles.ended}>
          <p>Plus de départ aujourd’hui à cet arrêt.</p>
          <div className={styles.lineLinks}>
            {stop.lines.map((line) => (
              <button key={line.id} type="button" className={styles.textButton} onClick={() => onOpenLine(line.code)}>
                Horaires de la ligne {line.code}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className={styles.groups}>
          {groups.map((group) => (
            <li key={group.key} className={styles.group}>
              <button type="button" className={styles.groupLine} onClick={() => onOpenLine(group.line.code)}>
                <LineBadge line={group.line} withName={false} />
                <span>
                  <strong>{group.line.name}</strong>
                  {group.direction && <small>vers {group.direction}</small>}
                </span>
              </button>
              {interrupted.has(group.line.id) ? (
                <p className={styles.cancelled}>Service interrompu : pas de départ assuré.</p>
              ) : (
                <ol className={styles.times}>
                  {group.departures.map((departure) => (
                    <li key={departure.id}>
                      <strong>{waitLabel(departure.minutes_until)}</strong>
                      <small>{departure.time}</small>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}
