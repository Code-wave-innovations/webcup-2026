import { useState } from 'react'
import { messageFor } from '../../../api/errors'
import {
  DAY_TYPE_LABEL,
  DAY_TYPES,
  TRANSIT_MODE_LABEL,
  TRANSIT_STATUS_LABEL,
  useDeleteLine,
  useSaveLine,
  useSetLineStops,
  useSetTimetable,
  useTransitLine,
  useTransitStops,
} from '../../../api/transit'
import type { DayType, TransitLine, TransitLineDetail, TransitMode } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { LINE_STATUS_TONE } from '../../lib/labels'
import { previewService, summarizeTimes } from '../../lib/timetable'
import { EntityHistory } from '../../shared/EntityHistory'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, FilterChips, Select, Tabs, TextArea, TextInput, Toggle } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Drawer } from '../../ui/Overlay'
import layout from '../../ui/layout.module.css'
import { LineCode } from './LineCode'
import styles from './admin.module.css'

type Section = 'infos' | 'arrets' | 'horaires' | 'historique'

const MODES = Object.keys(TRANSIT_MODE_LABEL) as TransitMode[]

/** F36: one line, in a drawer: its details, its stops in order, its timetables and its history. Agents read only. */
export function LineDrawer({ line, admin, onClose }: { line: TransitLine | null; admin: boolean; onClose: () => void }) {
  const [section, setSection] = useState<Section>(line ? 'arrets' : 'infos')
  const sections: { value: Section; label: string }[] = line
    ? [
        { value: 'arrets', label: 'Arrêts' },
        { value: 'horaires', label: 'Horaires' },
        { value: 'infos', label: 'Informations' },
        { value: 'historique', label: 'Historique' },
      ]
    : [{ value: 'infos', label: 'Informations' }]

  return (
    <Drawer open onClose={onClose} kicker={line ? `F36 · ${TRANSIT_MODE_LABEL[line.mode]}` : 'F36'} title={line ? `Ligne ${line.code} · ${line.name}` : 'Nouvelle ligne'}>
      <div className={layout.stack}>
        {line && (
          <div className={layout.row}>
            <LineCode line={line} />
            <Tag tone={LINE_STATUS_TONE[line.status]}>{TRANSIT_STATUS_LABEL[line.status]}</Tag>
            {!line.is_active && <Tag tone="neutral">Masquée aux habitants</Tag>}
          </div>
        )}
        {sections.length > 1 && <Tabs<Section> label="Sections de la ligne" idPrefix="ligne" value={section} onChange={setSection} tabs={sections} />}
        <div id="ligne-panel" role="tabpanel" aria-labelledby={`ligne-tab-${section}`} className={layout.stack}>
          {section === 'infos' && (admin ? <LineForm line={line} onClose={onClose} /> : line && <LineInfo line={line} />)}
          {line && section === 'arrets' && <LineStops line={line} admin={admin} />}
          {line && section === 'horaires' && <LineTimetable line={line} admin={admin} />}
          {line && section === 'historique' && <EntityHistory entity="TransitLine" entityId={line.id} />}
        </div>
      </div>
    </Drawer>
  )
}

function LineInfo({ line }: { line: TransitLine }) {
  return (
    <dl className={layout.dl}>
      <dt>Code</dt>
      <dd>{line.code}</dd>
      <dt>Nom</dt>
      <dd>{line.name}</dd>
      <dt>Mode</dt>
      <dd>{TRANSIT_MODE_LABEL[line.mode]}</dd>
      {line.description && (
        <>
          <dt>Description</dt>
          <dd>{line.description}</dd>
        </>
      )}
    </dl>
  )
}

function LineForm({ line, onClose }: { line: TransitLine | null; onClose: () => void }) {
  const save = useSaveLine()
  const remove = useDeleteLine()
  const [code, setCode] = useState(line?.code ?? '')
  const [name, setName] = useState(line?.name ?? '')
  const [mode, setMode] = useState<TransitMode>(line?.mode ?? 'BUS')
  const [color, setColor] = useState(line?.color ?? '')
  const [description, setDescription] = useState(line?.description ?? '')
  const [active, setActive] = useState(line?.is_active ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useApiForm({
    labels: { code: 'Code', name: 'Nom', color: 'Couleur', description: 'Description' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!code.trim()) errors.code = 'Indiquez le code affiché aux habitants (ex. T1).'
      if (!name.trim()) errors.name = 'Indiquez le nom de la ligne.'
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) errors.color = 'Couleur au format #RRVVBB.'
      return errors
    },
    submit: () =>
      save.mutateAsync({ id: line?.id, code: code.trim(), name: name.trim(), mode, color: color || null, description: description.trim() || null, is_active: active }),
    onSuccess: (saved) => {
      toast(line ? `Ligne ${saved.code} enregistrée` : `Ligne ${saved.code} créée : ajoutez ses arrêts puis ses horaires`)
      if (!line) onClose()
    },
  })

  const deleteLine = () =>
    line &&
    remove.mutateAsync(line.id).then(
      () => {
        toast(`Ligne ${line.code} supprimée`)
        onClose()
      },
      (error) => toast(messageFor(error), 'alert'),
    )

  return (
    <form
      noValidate
      className={layout.stack}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit(undefined)
      }}
    >
      <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
      <div className={layout.formGrid}>
        <Field id={form.fieldId('code')} label="Code" required error={form.errors.code}>
          {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />}
        </Field>
        <Field label="Mode">
          {(id) => (
            <Select id={id} value={mode} onChange={(event) => setMode(event.target.value as TransitMode)}>
              {MODES.map((value) => (
                <option key={value} value={value}>
                  {TRANSIT_MODE_LABEL[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field id={form.fieldId('name')} label="Nom" required hint="Les deux terminus, ex. « Tram Centre ↔ Sud »." error={form.errors.name}>
        {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={name} onChange={(event) => setName(event.target.value)} />}
      </Field>
      <Field id={form.fieldId('color')} label="Couleur" hint="Repère visuel seulement : le code et le nom restent toujours affichés." error={form.errors.color}>
        {(id, describedBy, invalid) => (
          <TextInput id={id} type="color" aria-describedby={describedBy} aria-invalid={invalid} value={color || '#4a90ff'} onChange={(event) => setColor(event.target.value)} />
        )}
      </Field>
      <Field id={form.fieldId('description')} label="Description" error={form.errors.description}>
        {(id, describedBy, invalid) => <TextArea id={id} aria-describedby={describedBy} aria-invalid={invalid} value={description} onChange={(event) => setDescription(event.target.value)} />}
      </Field>
      <Toggle checked={active} onChange={setActive} label="Visible des habitants" />
      <div className={layout.row}>
        <Button variant="primary" icon="check" type="submit" disabled={form.pending} aria-busy={form.pending}>
          {line ? 'Enregistrer' : 'Créer la ligne'}
        </Button>
        {line &&
          (confirmDelete ? (
            <>
              <Button variant="danger" disabled={remove.isPending} onClick={() => void deleteLine()}>
                Confirmer : supprimer la ligne, ses arrêts desservis et ses horaires
              </Button>
              <Button variant="subtle" onClick={() => setConfirmDelete(false)}>
                Garder la ligne
              </Button>
            </>
          ) : (
            <Button variant="subtle" onClick={() => setConfirmDelete(true)}>
              Supprimer…
            </Button>
          ))}
      </div>
    </form>
  )
}

/** Stops in the order the line serves them; admins reorder with buttons (keyboard friendly), add and remove. */
function LineStops({ line, admin }: { line: TransitLine; admin: boolean }) {
  const detail = useTransitLine(String(line.id))
  if (detail.isError) return <EmptyState title={messageFor(detail.error)} icon="alert" />
  if (!detail.data) return <Skeleton lines={4} />
  return <StopOrder key={detail.data.stops.map((stop) => stop.id).join('-')} line={detail.data} admin={admin} />
}

function StopOrder({ line, admin }: { line: TransitLineDetail; admin: boolean }) {
  const allStops = useTransitStops({}, admin)
  const setStops = useSetLineStops()
  const [order, setOrder] = useState(line.stops.map((stop) => ({ id: stop.id, name: stop.name, district: stop.district?.name })))
  const [adding, setAdding] = useState(0)
  const changed = order.map((stop) => stop.id).join('-') !== line.stops.map((stop) => stop.id).join('-')
  const available = (allStops.data ?? []).filter((stop) => !order.some((s) => s.id === stop.id))

  const move = (index: number, delta: number) =>
    setOrder((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })

  const add = () => {
    const stop = available.find((s) => s.id === adding)
    if (!stop) return
    setOrder((current) => [...current, { id: stop.id, name: stop.name, district: stop.district?.name }])
    setAdding(0)
  }

  const save = () =>
    setStops.mutateAsync({ id: line.id, stop_ids: order.map((stop) => stop.id) }).then(
      () => toast(`Arrêts de la ligne ${line.code} enregistrés · pensez à régénérer ses horaires`),
      (error) => toast(messageFor(error), 'alert'),
    )

  return (
    <>
      {order.length === 0 ? (
        <EmptyState title="Aucun arrêt desservi" icon="pin" />
      ) : (
        <ol className={styles.sectionList}>
          {order.map((stop, index) => (
            <li key={stop.id} className={styles.sectionItem}>
              <span className={styles.sectionIndex}>{String(index + 1).padStart(2, '0')}</span>
              {admin ? (
                <span className={styles.moveButtons}>
                  <Button size="sm" variant="subtle" iconOnly icon="arrowUp" disabled={index === 0} onClick={() => move(index, -1)}>
                    Monter {stop.name}
                  </Button>
                  <Button size="sm" variant="subtle" iconOnly icon="arrowDown" disabled={index === order.length - 1} onClick={() => move(index, 1)}>
                    Descendre {stop.name}
                  </Button>
                </span>
              ) : (
                <span />
              )}
              <span>
                {stop.name}
                {stop.district && <small className={layout.muted}> · {stop.district}</small>}
              </span>
              {admin ? (
                <Button size="sm" variant="subtle" iconOnly icon="close" disabled={order.length === 1} onClick={() => setOrder((current) => current.filter((s) => s.id !== stop.id))}>
                  Retirer {stop.name}
                </Button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      )}
      {admin && (
        <>
          <div className={styles.number}>
            <Field label="Ajouter un arrêt">
              {(id) => (
                <Select id={id} value={adding} onChange={(event) => setAdding(Number(event.target.value))}>
                  <option value={0}>Choisir un arrêt</option>
                  {available.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                      {stop.district ? ` (${stop.district.name})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button size="sm" icon="plus" disabled={!adding} onClick={add}>
              Ajouter
            </Button>
          </div>
          <div className={layout.row}>
            <Button variant="primary" icon="check" disabled={!changed || order.length === 0 || setStops.isPending} onClick={() => void save()}>
              Enregistrer l’ordre
            </Button>
            {changed && (
              <Button variant="subtle" onClick={() => setOrder(line.stops.map((stop) => ({ id: stop.id, name: stop.name, district: stop.district?.name })))}>
                Annuler les changements
              </Button>
            )}
          </div>
          <p className={[layout.muted, layout.small].join(' ')}>Les horaires suivent l’ordre des arrêts : après un changement, régénérez-les dans l’onglet Horaires.</p>
        </>
      )}
    </>
  )
}

/** Current timetable of a day type and, for admins, the regular service generator with its preview. */
function LineTimetable({ line, admin }: { line: TransitLine; admin: boolean }) {
  const [day, setDay] = useState<DayType>('WEEKDAY')
  const detail = useTransitLine(String(line.id), day)
  return (
    <>
      <FilterChips<DayType> label="Type de jour" value={day} onChange={setDay} options={DAY_TYPES.map((value) => ({ value, label: DAY_TYPE_LABEL[value] }))} />
      {detail.isError ? (
        <EmptyState title={messageFor(detail.error)} icon="alert" />
      ) : !detail.data || detail.data.day_type !== day ? (
        <Skeleton lines={4} />
      ) : (
        <TimetableEditor key={`${day}-${detail.data.updated_at}`} line={detail.data} day={day} admin={admin} />
      )}
    </>
  )
}

/** The service currently stored, read at the first stop: first and last departures, interval. */
function currentService(line: TransitLineDetail) {
  const times = Object.values(line.stops[0]?.times_by_direction ?? {})[0] ?? []
  const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
  return {
    times,
    first: times[0] ?? '06:00',
    last: times[times.length - 1] ?? '22:00',
    every: times.length > 1 ? minutes(times[1]) - minutes(times[0]) : 15,
    directions: Object.keys(line.stops[0]?.times_by_direction ?? {}).length,
  }
}

function TimetableEditor({ line, day, admin }: { line: TransitLineDetail; day: DayType; admin: boolean }) {
  const current = currentService(line)
  const setTimetable = useSetTimetable()
  const [first, setFirst] = useState(current.first)
  const [last, setLast] = useState(current.last)
  const [every, setEvery] = useState(current.every)
  const [between, setBetween] = useState(4)
  const [returnTrip, setReturnTrip] = useState(current.directions !== 1)

  const stopNames = line.stops.map((stop) => stop.name)
  const preview = previewService(stopNames, { first, last, everyMinutes: every, minutesBetweenStops: between, returnTrip })
  const total = preview.reduce((sum, direction) => sum + direction.departures, 0)

  const form = useApiForm({
    labels: { first: 'Premier départ', last: 'Dernier départ', every_minutes: 'Fréquence', minutes_between_stops: 'Temps entre deux arrêts' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (line.stops.length === 0) errors.first = 'Ajoutez d’abord les arrêts de la ligne.'
      else if (!first) errors.first = 'Indiquez l’heure du premier départ.'
      if (!last) errors.last = 'Indiquez l’heure du dernier départ.'
      else if (first && last < first) errors.last = 'Le dernier départ doit suivre le premier.'
      if (!(every >= 1 && every <= 240)) errors.every_minutes = 'Entre 1 et 240 minutes.'
      if (!(between >= 0 && between <= 60)) errors.minutes_between_stops = 'Entre 0 et 60 minutes.'
      return errors
    },
    submit: () => setTimetable.mutateAsync({ id: line.id, day_type: day, first, last, every_minutes: every, minutes_between_stops: between, return_trip: returnTrip }),
    onSuccess: (saved) => toast(`Horaires de la ligne ${line.code} (${DAY_TYPE_LABEL[day].toLowerCase()}) : ${saved.departures} départs enregistrés`),
  })

  return (
    <>
      <div className={styles.preview}>
        <span className={styles.previewLabel}>Actuellement</span>
        <p className={layout.small}>
          {current.times.length === 0
            ? 'Aucun horaire pour ce type de jour.'
            : `Au départ de ${line.stops[0].name} : ${summarizeTimes(current.times)} (${current.times.length} passages${current.directions > 1 ? ', dans chaque sens' : ''}).`}
        </p>
      </div>

      {admin && (
        <form
          noValidate
          className={layout.stack}
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit(undefined)
          }}
        >
          <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
          <div className={layout.formGrid}>
            <Field id={form.fieldId('first')} label="Premier départ" required error={form.errors.first}>
              {(id, describedBy, invalid) => <TextInput id={id} type="time" aria-describedby={describedBy} aria-invalid={invalid} value={first} onChange={(event) => setFirst(event.target.value)} />}
            </Field>
            <Field id={form.fieldId('last')} label="Dernier départ" required error={form.errors.last}>
              {(id, describedBy, invalid) => <TextInput id={id} type="time" aria-describedby={describedBy} aria-invalid={invalid} value={last} onChange={(event) => setLast(event.target.value)} />}
            </Field>
            <Field id={form.fieldId('every_minutes')} label="Un départ toutes les (min)" required error={form.errors.every_minutes}>
              {(id, describedBy, invalid) => (
                <TextInput id={id} type="number" min={1} max={240} aria-describedby={describedBy} aria-invalid={invalid} value={every} onChange={(event) => setEvery(Number(event.target.value))} />
              )}
            </Field>
            <Field id={form.fieldId('minutes_between_stops')} label="Minutes entre deux arrêts" error={form.errors.minutes_between_stops}>
              {(id, describedBy, invalid) => (
                <TextInput id={id} type="number" min={0} max={60} aria-describedby={describedBy} aria-invalid={invalid} value={between} onChange={(event) => setBetween(Number(event.target.value))} />
              )}
            </Field>
          </div>
          <Toggle checked={returnTrip} onChange={setReturnTrip} label="Trajet retour aux mêmes heures" />

          <div className={styles.preview} aria-live="polite">
            <span className={styles.previewLabel}>Aperçu avant enregistrement</span>
            {preview.length === 0 ? (
              <p className={layout.small}>Complétez les champs pour voir les horaires générés.</p>
            ) : (
              <>
                {preview.map((direction) => (
                  <p key={direction.towards} className={layout.small}>
                    <strong>Vers {direction.towards}</strong> : {direction.times.length} passages, {summarizeTimes(direction.times)}
                  </p>
                ))}
                <p className={[layout.small, layout.muted].join(' ')}>
                  {total} départs au total pour « {DAY_TYPE_LABEL[day]} ». Ils remplacent les horaires actuels de ce type de jour.
                </p>
              </>
            )}
          </div>

          <div>
            <Button variant="primary" icon="clock" type="submit" disabled={form.pending || preview.length === 0} aria-busy={form.pending}>
              Générer et enregistrer
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
