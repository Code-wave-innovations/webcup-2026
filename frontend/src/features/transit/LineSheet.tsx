import { useEffect, useRef, useState } from 'react'
import { messageFor } from '../../api/errors'
import { DAY_TYPE_LABEL, DAY_TYPES, TRANSIT_MODE_LABEL, TRANSIT_STATUS_LABEL, useTransitDisruptions, useTransitLine } from '../../api/transit'
import type { DayType } from '../../api/types'
import { Pill } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { LineBadge } from './LineBadge'
import { lineLabel, STATUS_TONE, timetableByDirection } from './transitText'
import styles from './Transit.module.css'

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
            Fermer
          </Button>
        </div>
      </GlassPanel>
    )
  }
  if (!line.data) return <p className={text.note}>Chargement de la ligne {code}…</p>

  const data = line.data
  const disruption = disruptions.data ? (disruptions.data.find((l) => l.id === data.id) ?? { status: 'NORMAL' as const, status_message: null }) : data
  const shownDay = day ?? data.day_type
  const timetables = timetableByDirection(data.stops)
  return (
    <GlassPanel className={styles.sheet} role="region" aria-labelledby="ligne-titre">
      <div className={styles.sheetHead}>
        <div>
          <small className={styles.kicker}>{TRANSIT_MODE_LABEL[data.mode]}</small>
          <h2 id="ligne-titre" ref={titleRef} tabIndex={-1} className={styles.sheetTitle}>
            <LineBadge line={data} />
          </h2>
        </div>
        <Button small variant="ghost" onClick={onClose}>
          Fermer la ligne
        </Button>
      </div>

      <div className={styles.disruptionHead}>
        <Pill tone={STATUS_TONE[disruption.status]}>{TRANSIT_STATUS_LABEL[disruption.status]}</Pill>
      </div>
      {disruption.status_message && <p className={styles.message}>{disruption.status_message}</p>}
      {data.description && <p className={text.note}>{data.description}</p>}

      <fieldset className={styles.chips}>
        <legend className={text.note}>Horaires pour</legend>
        {DAY_TYPES.map((value) => (
          <button key={value} type="button" aria-pressed={shownDay === value} onClick={() => setDay(value)}>
            {DAY_TYPE_LABEL[value]}
          </button>
        ))}
      </fieldset>

      {timetables.length === 0 ? (
        <p className={text.note}>Aucun horaire pour ce jour.</p>
      ) : (
        timetables.map((timetable) => (
          <div key={timetable.direction} className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {timetable.direction ? `Vers ${timetable.direction}` : 'Horaires'} · ligne {lineLabel(data)}, {DAY_TYPE_LABEL[shownDay].toLowerCase()}, arrêts
                dans l’ordre du parcours
              </caption>
              <thead>
                <tr>
                  <th scope="col">Arrêt</th>
                  <th scope="col">Premier départ</th>
                  <th scope="col">Dernier départ</th>
                  <th scope="col">Tous les départs</th>
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
                        <summary>{times.length} départs</summary>
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
