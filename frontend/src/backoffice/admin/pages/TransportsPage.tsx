import { useState } from 'react'
import { motion } from 'motion/react'
import { useSearchParams } from 'react-router'
import { messageFor } from '../../../api/errors'
import { TRANSIT_MODE_LABEL, TRANSIT_STATUS_LABEL, useTransitLines, useUpdateLineStatus } from '../../../api/transit'
import type { TransitLine, TransitLineStatus } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { usePersona } from '../../layout/persona'
import { LINE_STATUS_TONE } from '../../lib/labels'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { DataTable } from '../../ui/DataTable'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, FilterChips, Tabs, TextArea, Toggle } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import { LineCode } from './LineCode'
import { LineDrawer } from './TransportLine'
import { TransportStops } from './TransportStops'
import styles from './admin.module.css'

type TabKey = 'lignes' | 'arrets'

/**
 * F36: municipal transport. Every staff member reports a disruption (and warns the residents of the districts
 * served) or restores a line; admins also manage lines, stops, stop order and timetables.
 * `?ligne=CODE` (the staff notification link) opens that line.
 */
export default function TransportsPage() {
  const admin = usePersona() === 'ADMIN'
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>('lignes')
  const lines = useTransitLines(true)
  const restore = useUpdateLineStatus()
  const [reporting, setReporting] = useState<TransitLine | null>(null)
  const [creating, setCreating] = useState(false)

  const openCode = params.get('ligne')?.toUpperCase()
  const opened = openCode ? lines.data?.find((line) => line.code === openCode) : undefined
  const openLine = (line: TransitLine) => setParams({ ligne: line.code }, { replace: true })
  const closeLine = () => setParams({}, { replace: true })

  const list = lines.data ?? []
  const disrupted = list.filter((line) => line.is_active && line.status !== 'NORMAL')

  const restoreLine = (line: TransitLine) =>
    restore.mutateAsync({ id: line.id, status: 'NORMAL', status_message: null }).then(
      () => toast(`Ligne ${line.code} rétablie`),
      (error) => toast(messageFor(error), 'alert'),
    )

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Transports"
        codes={['F36']}
        lead="Signalez une perturbation en une action : les habitants la voient en moins d’une minute sur l’accueil et l’écran Transports, et ceux des quartiers desservis peuvent être prévenus."
        actions={
          admin && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nouvelle ligne
            </Button>
          )
        }
      />

      <Panel kicker="En ce moment" title="État du réseau" accent={disrupted.some((line) => line.status === 'INTERRUPTED') ? 'alert' : disrupted.length ? 'ember' : undefined}>
        {!lines.data ? (
          lines.isError ? <EmptyState title={messageFor(lines.error)} icon="alert" /> : <Skeleton lines={2} />
        ) : disrupted.length === 0 ? (
          <EmptyState title="Toutes les lignes fonctionnent normalement" icon="check" />
        ) : (
          <ul className={styles.sectionList}>
            {disrupted.map((line) => (
              <li key={line.id} className={styles.lineAlert}>
                <LineCode line={line} />
                <span>
                  <strong>{line.name}</strong>
                  {line.status_message && <small className={layout.muted}>{line.status_message}</small>}
                </span>
                <Tag tone={LINE_STATUS_TONE[line.status]} pulse>
                  {TRANSIT_STATUS_LABEL[line.status]}
                </Tag>
                <span className={layout.row}>
                  <Button size="sm" variant="subtle" icon="edit" onClick={() => setReporting(line)}>
                    Modifier le message
                  </Button>
                  <Button size="sm" icon="check" disabled={restore.isPending} onClick={() => void restoreLine(line)}>
                    Rétablir
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Tabs<TabKey>
        label="Référentiel des transports"
        idPrefix="transports"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'lignes', label: 'Lignes', count: lines.data?.length },
          { value: 'arrets', label: 'Arrêts' },
        ]}
      />

      <div id="transports-panel" role="tabpanel" aria-labelledby={`transports-tab-${tab}`}>
        {tab === 'lignes' ? (
          <Panel title="Lignes" kicker={admin ? 'Cliquez une ligne pour ses arrêts et horaires' : 'Cliquez une ligne pour ses arrêts'}>
            {!lines.data ? (
              lines.isError ? <EmptyState title={messageFor(lines.error)} icon="alert" /> : <Skeleton lines={4} />
            ) : (
              <DataTable<TransitLine>
                caption="Lignes de transport"
                rows={list}
                rowKey={(line) => line.id}
                onRowClick={openLine}
                rowTone={(line) => (line.status === 'INTERRUPTED' ? 'alert' : line.status === 'DISRUPTED' ? 'ember' : undefined)}
                initialSort={{ key: 'code', dir: 'asc' }}
                columns={[
                  { key: 'code', header: 'Ligne', sortValue: (line) => line.code, cell: (line) => <LineCode line={line} />, width: '90px' },
                  {
                    key: 'name',
                    header: 'Nom',
                    sortValue: (line) => line.name,
                    cell: (line) => (
                      <span>
                        {line.name}
                        {!line.is_active && <small className={layout.muted}> · masquée</small>}
                      </span>
                    ),
                  },
                  { key: 'mode', header: 'Mode', hideOnPhone: true, cell: (line) => TRANSIT_MODE_LABEL[line.mode] },
                  { key: 'stops', header: 'Arrêts', align: 'end', hideOnPhone: true, sortValue: (line) => line._count?.stops ?? 0, cell: (line) => line._count?.stops ?? 0 },
                  {
                    key: 'status',
                    header: 'État',
                    sortValue: (line) => line.status,
                    cell: (line) => <Tag tone={LINE_STATUS_TONE[line.status]}>{TRANSIT_STATUS_LABEL[line.status]}</Tag>,
                  },
                  {
                    key: 'action',
                    header: 'Action',
                    align: 'end',
                    cell: (line) => (
                      // the row opens the line: keep the click (and Enter) on the button
                      <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        {line.status === 'NORMAL' ? (
                          <Button size="sm" variant="subtle" icon="alert" onClick={() => setReporting(line)}>
                            Signaler une perturbation
                          </Button>
                        ) : (
                          <Button size="sm" icon="check" disabled={restore.isPending} onClick={() => void restoreLine(line)}>
                            Rétablir
                          </Button>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Panel>
        ) : (
          <TransportStops admin={admin} />
        )}
      </div>

      {reporting && <StatusForm key={reporting.id} line={reporting} onClose={() => setReporting(null)} />}
      {(opened || creating) && <LineDrawer key={opened?.id ?? 'new'} line={creating ? null : opened!} admin={admin} onClose={creating ? () => setCreating(false) : closeLine} />}
    </motion.div>
  )
}

type Disruption = Exclude<TransitLineStatus, 'NORMAL'>

/** Report (or reword) a disruption; the message is what residents read, with the expected recovery. */
function StatusForm({ line, onClose }: { line: TransitLine; onClose: () => void }) {
  const update = useUpdateLineStatus()
  const [status, setStatus] = useState<Disruption>(line.status === 'INTERRUPTED' ? 'INTERRUPTED' : 'DISRUPTED')
  const [message, setMessage] = useState(line.status_message ?? '')
  const [notify, setNotify] = useState(line.status === 'NORMAL')

  const form = useApiForm({
    labels: { status: 'État', status_message: 'Message aux habitants' },
    validate: (): Record<string, string> => (message.trim().length < 5 ? { status_message: 'Dites ce qui se passe et quand le service reprend.' } : {}),
    submit: () => update.mutateAsync({ id: line.id, status, status_message: message.trim(), notify }),
    onSuccess: (saved) => {
      const notified = saved.notified ?? 0
      toast(
        notify
          ? `Ligne ${line.code} : ${TRANSIT_STATUS_LABEL[status].toLowerCase()} · ${notified} habitant${notified > 1 ? 's' : ''} prévenu${notified > 1 ? 's' : ''}`
          : `Ligne ${line.code} : ${TRANSIT_STATUS_LABEL[status].toLowerCase()}`,
      )
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      kicker={`F36 · Ligne ${line.code}`}
      title={line.status === 'NORMAL' ? `Signaler une perturbation · ${line.name}` : `Modifier la perturbation · ${line.name}`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="send" type="submit" form="line-status-form" disabled={form.pending} aria-busy={form.pending}>
            Publier
          </Button>
        </>
      }
    >
      <form
        id="line-status-form"
        noValidate
        className={layout.stack}
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <FilterChips<Disruption>
          label="État"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'DISRUPTED', label: 'Perturbée (retards, déviation)' },
            { value: 'INTERRUPTED', label: 'Interrompue' },
          ]}
        />
        <Field id={form.fieldId('status_message')} label="Message aux habitants" required hint="Ce qui se passe, la reprise prévue et l’alternative. Ex. « Reprise à 20:00. En attendant, prenez le bus B2. »" error={form.errors.status_message}>
          {(id, describedBy, invalid) => (
            <TextArea id={id} data-autofocus aria-describedby={describedBy} aria-invalid={invalid} value={message} onChange={(event) => setMessage(event.target.value)} />
          )}
        </Field>
        <Toggle checked={notify} onChange={setNotify} label="Prévenir les habitants des quartiers desservis" />
        <div className={styles.preview}>
          <span className={styles.previewLabel}>Ce que voit l’habitant</span>
          <p className={layout.small}>
            <strong>
              {line.code} · {line.name} — {TRANSIT_STATUS_LABEL[status]}
            </strong>
          </p>
          <p className={layout.small}>{message.trim() || '…'}</p>
        </div>
      </form>
    </Modal>
  )
}
