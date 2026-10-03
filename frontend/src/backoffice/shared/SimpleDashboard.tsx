import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useDashboardSummary } from '../../api/dashboard'
import { messageFor } from '../../api/errors'
import type { DashboardSummary, SummaryPeriod } from '../../api/types'
import { formatHours, formatNumber, formatRelative } from '../lib/format'
import { stateOf, THRESHOLDS, type IndicatorState } from '../lib/thresholds'
import { useNow } from '../lib/useNow'
import { FilterChips } from '../ui/Controls'
import { EmptyState, Skeleton } from '../ui/Feedback'
import { Icon, type IconName } from '../ui/Icon'
import styles from './SimpleDashboard.module.css'

/*
  F50: the simplified dashboard, read in ten seconds without a chart. At most six indicators,
  each written as a sentence with its comparison, then what needs attention. Shared by both spaces:
  each passes its own indicators and its base path for the links.
*/

export type SimpleIndicator =
  | 'awaiting_pickup'
  | 'overdue'
  | 'requests_received'
  | 'requests_resolved'
  | 'median_pickup_hours'
  | 'appointments'
  | 'new_citizens'

const PERIODS: { value: SummaryPeriod; slug: string; label: string; current: string; previous: string }[] = [
  { value: 'today', slug: 'aujourdhui', label: 'Aujourd’hui', current: 'aujourd’hui', previous: 'hier à la même heure' },
  { value: '7d', slug: '7j', label: '7 jours', current: 'ces 7 derniers jours', previous: 'les 7 jours précédents' },
  { value: '30d', slug: '30j', label: '30 jours', current: 'ces 30 derniers jours', previous: 'les 30 jours précédents' },
]

const STATE: Record<IndicatorState, { icon: IconName; word: string }> = {
  normal: { icon: 'check', word: 'Normal' },
  watch: { icon: 'eye', word: 'À surveiller' },
  critical: { icon: 'alert', word: 'Critique' },
}

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n > 1 ? many : one}`

/** "5 de plus que …", "2 de moins que …", "stable par rapport à …", with an arrow that never stands alone. */
function comparison(value: number, previous: number | null, previousLabel: string): { text: string; icon: IconName | null } | null {
  if (previous === null) return null
  const diff = value - previous
  if (diff === 0) return { text: `stable par rapport à ${previousLabel}`, icon: null }
  return { text: `${formatNumber(Math.abs(diff))} de ${diff > 0 ? 'plus' : 'moins'} que ${previousLabel}`, icon: diff > 0 ? 'arrowUp' : 'arrowDown' }
}

interface Line {
  key: SimpleIndicator
  figure: string
  sentence: ReactNode
  detail?: ReactNode
  compare: { text: string; icon: IconName | null } | null
  state: IndicatorState
  link?: { to: string; label: string }
}

function lines(summary: DashboardSummary, keys: SimpleIndicator[], base: string, now: number): Line[] {
  const period = PERIODS.find((p) => p.value === summary.period.key) ?? PERIODS[1]
  const i = summary.indicators
  const queue = { to: `${base}/demandes`, label: 'Voir la file' }

  const build: Record<SimpleIndicator, () => Line> = {
    awaiting_pickup: () => ({
      key: 'awaiting_pickup',
      figure: formatNumber(i.awaiting_pickup.value),
      sentence:
        i.awaiting_pickup.value === 0
          ? 'Aucune demande n’attend de prise en charge.'
          : `${plural(i.awaiting_pickup.value, 'demande attend', 'demandes attendent')} une prise en charge.`,
      detail: i.awaiting_pickup.oldest_at && `La plus ancienne a été envoyée ${formatRelative(i.awaiting_pickup.oldest_at, now)}.`,
      compare: null,
      state: stateOf(i.awaiting_pickup.value, THRESHOLDS.awaitingPickup),
      link: queue,
    }),
    overdue: () => ({
      key: 'overdue',
      figure: formatNumber(i.overdue.value),
      sentence: i.overdue.value === 0 ? 'Aucune demande en retard.' : `${plural(i.overdue.value, 'demande est', 'demandes sont')} en retard.`,
      detail: 'Délai selon la priorité : 4 h si urgente, 1 jour si haute, 3 jours sinon.',
      compare: null,
      state: stateOf(i.overdue.value, THRESHOLDS.overdue),
      link: queue,
    }),
    requests_received: () => ({
      key: 'requests_received',
      figure: formatNumber(i.requests_received.value),
      sentence: `${plural(i.requests_received.value, 'demande reçue', 'demandes reçues')} ${period.current}.`,
      compare: comparison(i.requests_received.value, i.requests_received.previous, period.previous),
      state: 'normal',
      link: queue,
    }),
    requests_resolved: () => ({
      key: 'requests_resolved',
      figure: formatNumber(i.requests_resolved.value),
      sentence: `${plural(i.requests_resolved.value, 'demande résolue', 'demandes résolues')} ${period.current}.`,
      compare: comparison(i.requests_resolved.value, i.requests_resolved.previous, period.previous),
      state: 'normal',
    }),
    median_pickup_hours: () => {
      const { value, previous } = i.median_pickup_hours
      const faster = value !== null && previous !== null && Math.round(value) !== Math.round(previous)
      return {
        key: 'median_pickup_hours',
        figure: value === null ? '—' : formatHours(value),
        sentence: value === null ? `Aucune prise en charge ${period.current}.` : `Délai médian avant la prise en charge ${period.current}.`,
        compare:
          value === null || previous === null
            ? null
            : faster
              ? {
                  text: `${formatHours(Math.abs(value - previous))} plus ${value < previous ? 'rapide' : 'lent'} que ${period.previous}`,
                  icon: value < previous ? 'arrowDown' : 'arrowUp',
                }
              : { text: `stable par rapport à ${period.previous}`, icon: null },
        state: stateOf(value, THRESHOLDS.medianPickupHours),
      }
    },
    appointments: () => {
      const { value, previous, no_show } = i.appointments
      return {
        key: 'appointments',
        figure: formatNumber(value),
        sentence: `${plural(value, 'rendez-vous', 'rendez-vous')} ${period.current}.`,
        detail: no_show > 0 ? `${plural(no_show, 'personne n’est pas venue', 'personnes ne sont pas venues')}.` : undefined,
        compare: comparison(value, previous, period.previous),
        state: stateOf(value > 0 ? no_show / value : null, THRESHOLDS.noShowRate),
        link: { to: `${base}/rendez-vous`, label: 'Voir l’agenda' },
      }
    },
    new_citizens: () => ({
      key: 'new_citizens',
      figure: formatNumber(i.new_citizens.value),
      sentence: `${plural(i.new_citizens.value, 'nouvel habitant inscrit', 'nouveaux habitants inscrits')} ${period.current}.`,
      compare: comparison(i.new_citizens.value, i.new_citizens.previous, period.previous),
      state: 'normal',
      link: { to: base === '/admin' ? '/admin/utilisateurs' : '/agent/citoyens', label: 'Voir les comptes' },
    }),
  }
  return keys.slice(0, 6).map((key) => build[key]())
}

/** The period lives in the URL (?periode=7j) so a link or a reload shows the same figures. */
function usePeriod() {
  const [params, setParams] = useSearchParams()
  const period = PERIODS.find((p) => p.slug === params.get('periode')) ?? PERIODS[1]
  const setPeriod = (value: SummaryPeriod) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('periode', PERIODS.find((p) => p.value === value)!.slug)
        return next
      },
      { replace: true },
    )
  return [period.value, setPeriod] as const
}

export function SimpleDashboard({ indicators, base }: { indicators: SimpleIndicator[]; base: '/agent' | '/admin' }) {
  const now = useNow()
  const [period, setPeriod] = usePeriod()
  const summary = useDashboardSummary(period)
  const data = summary.data
  const current = PERIODS.find((p) => p.value === period)!

  return (
    <div className={styles.simple}>
      <div className={styles.periodBar}>
        <FilterChips<SummaryPeriod> label="Période" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        <p className={styles.printPeriod}>Période : {current.label}</p>
      </div>

      <section className={styles.block} aria-labelledby="simple-indicators" aria-busy={summary.isFetching} data-print-block>
        <h2 id="simple-indicators" className={styles.heading}>
          L’activité {current.current}
        </h2>
        {data ? (
          <ol className={styles.lines}>
            {lines(data, indicators, base, now).map((line) => (
              <li key={line.key} className={[styles.line, styles[line.state]].join(' ')}>
                <span className={styles.figure} aria-hidden="true">
                  {line.figure}
                </span>
                <div className={styles.text}>
                  <p className={styles.sentence}>
                    <strong>
                      <span className="bo-sr-only">{line.figure} — </span>
                      {line.sentence}
                    </strong>{' '}
                    {line.detail}
                  </p>
                  {line.compare && (
                    <p className={styles.compare}>
                      {line.compare.icon && <Icon name={line.compare.icon} size={14} />}
                      {line.compare.text}
                    </p>
                  )}
                </div>
                <span className={styles.state}>
                  <Icon name={STATE[line.state].icon} size={15} />
                  {STATE[line.state].word}
                </span>
                {line.link ? (
                  <Link to={line.link.to} className={styles.link} data-print-hide>
                    {line.link.label}
                    <Icon name="chevronRight" size={14} />
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ol>
        ) : summary.isError ? (
          <EmptyState title={messageFor(summary.error)} icon="alert" />
        ) : (
          <Skeleton lines={5} />
        )}
      </section>

      <section className={styles.block} aria-labelledby="simple-watch" data-print-block>
        <h2 id="simple-watch" className={styles.heading}>
          À surveiller
        </h2>
        {!data ? (
          summary.isError ? null : <Skeleton lines={3} />
        ) : data.watch.length === 0 ? (
          <p className={styles.calm}>
            <Icon name="check" size={15} /> Rien à signaler : pas d’alerte, de service coupé ni de demande en retard.
          </p>
        ) : (
          <ul className={styles.watchList}>
            {data.watch.map((item) => (
              <li key={`${item.kind}-${item.label}`} className={styles[item.severity === 'critical' ? 'critical' : 'watch']}>
                <span className={styles.state}>
                  <Icon name={item.severity === 'critical' ? 'alert' : 'eye'} size={15} />
                  {item.severity === 'critical' ? 'Critique' : 'À surveiller'}
                </span>
                {item.link ? <Link to={item.link}>{item.label}</Link> : <span>{item.label}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
