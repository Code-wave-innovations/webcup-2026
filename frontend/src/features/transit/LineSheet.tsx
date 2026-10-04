import { useEffect, useRef, useState } from 'react'
import { messageFor } from '../../api/errors'
import { DAY_TYPES, dayTypeLabel, transitModeLabel, transitStatusLabel, useTransitDisruptions, useTransitLine } from '../../api/transit'
import type { DayType } from '../../api/types'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Pill } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { LineBadge } from './LineBadge'
import { lineLabel, STATUS_TONE, timetableByDirection } from './transitText'
import styles from './Transit.module.css'

const messages = defineMessages(
  {
    close: 'Fermer',
    closeLine: 'Fermer la ligne',
    loading: (code: string) => `Chargement de la ligne ${code}…`,
    hoursFor: 'Horaires pour',
    noHours: 'Aucun horaire pour ce jour.',
    captionTowards: (direction: string, line: string, day: string) =>
      `Vers ${direction} · ligne ${line}, ${day}, arrêts dans l’ordre du parcours`,
    captionHours: (line: string, day: string) => `Horaires · ligne ${line}, ${day}, arrêts dans l’ordre du parcours`,
    stop: 'Arrêt',
    first: 'Premier départ',
    last: 'Dernier départ',
    all: 'Tous les départs',
    departures: (n: number) => (n > 1 ? `${n} départs` : `${n} départ`),
  },
  {
    close: 'Close',
    closeLine: 'Close the line',
    loading: (code) => `Loading line ${code}…`,
    hoursFor: 'Timetable for',
    noHours: 'No timetable for this day.',
    captionTowards: (direction, line, day) => `To ${direction} · line ${line}, ${day}, stops in route order`,
    captionHours: (line, day) => `Timetable · line ${line}, ${day}, stops in route order`,
    stop: 'Stop',
    first: 'First departure',
    last: 'Last departure',
    all: 'All departures',
    departures: (n) => (n === 1 ? '1 departure' : `${n} departures`),
  },
)

/**
 * F36: a line on the same screen (opened by `?ligne=CODE`, also the target of the disruption notification):
 * its status, its stops in order and the timetable of a day type, as a table.
 */
export function LineSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const [day, setDay] = useState<DayType | undefined>()
  const line = useTransitLine(code, day)
  // F95: the timetable is refreshed every 5 minutes; the status comes from the disruptions, polled every minute (F36)
  const disruptions = useTransitDisruptions()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const loaded = !!line.data
  const m = useMessages(messages)
  const locale = useLocale()

  // opened from a link or a notification: the sheet takes the focus once its title exists
  useEffect(() => {
    if (loaded) titleRef.current?.focus({ preventScroll: false })
  }, [loaded, code])

  if (line.isError) {
    return (
      <GlassPanel className={styles.sheet}>
        <p className={text.error}>{messageFor(line.error)}</p>
        <div>
          <Button small variant="ghost" onClick={onClose}>
            {m.close}
          </Button>
        </div>
      </GlassPanel>
    )
  }
  if (!line.data) return <p className={text.note}>{m.loading(code)}</p>

  const data = line.data
  const disruption = disruptions.data ? (disruptions.data.find((l) => l.id === data.id) ?? { status: 'NORMAL' as const, status_message: null }) : data
  const shownDay = day ?? data.day_type
  const dayLabel = dayTypeLabel(shownDay, locale)
  const timetables = timetableByDirection(data.stops)
  return (
    <GlassPanel className={styles.sheet} role="region" aria-labelledby="ligne-titre">
      <div className={styles.sheetHead}>
        <div>
          <small className={styles.kicker}>{transitModeLabel(data.mode, locale)}</small>
          <h2 id="ligne-titre" ref={titleRef} tabIndex={-1} className={styles.sheetTitle}>
            <LineBadge line={data} />
          </h2>
        </div>
        <Button small variant="ghost" onClick={onClose}>
          {m.closeLine}
        </Button>
      </div>

      <div className={styles.disruptionHead}>
        <Pill tone={STATUS_TONE[disruption.status]}>{transitStatusLabel(disruption.status, locale)}</Pill>
      </div>
      {disruption.status_message && <p className={styles.message}>{disruption.status_message}</p>}
      {data.description && <p className={text.note}>{data.description}</p>}

      <fieldset className={styles.chips}>
        <legend className={text.note}>{m.hoursFor}</legend>
        {DAY_TYPES.map((value) => (
          <button key={value} type="button" aria-pressed={shownDay === value} onClick={() => setDay(value)}>
            {dayTypeLabel(value, locale)}
          </button>
        ))}
      </fieldset>

      {timetables.length === 0 ? (
        <p className={text.note}>{m.noHours}</p>
      ) : (
        timetables.map((timetable) => (
          <div key={timetable.direction} className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {timetable.direction
                  ? m.captionTowards(timetable.direction, lineLabel(data), dayLabel.toLowerCase())
                  : m.captionHours(lineLabel(data), dayLabel.toLowerCase())}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{m.stop}</th>
                  <th scope="col">{m.first}</th>
                  <th scope="col">{m.last}</th>
                  <th scope="col">{m.all}</th>
                </tr>
              </thead>
              <tbody>
                {timetable.rows.map(({ stop, times }, index) => (
                  <tr key={stop.id}>
                    <th scope="row">
                      <span className={styles.position}>{index + 1}.</span> {stop.name}
                      {stop.district && <small>{stop.district.name}</small>}
                    </th>
                    <td>{times[0]}</td>
                    <td>{times[times.length - 1]}</td>
                    <td>
                      <details>
                        <summary>{m.departures(times.length)}</summary>
                        <p className={styles.allTimes}>{times.join(' · ')}</p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </GlassPanel>
  )
}
