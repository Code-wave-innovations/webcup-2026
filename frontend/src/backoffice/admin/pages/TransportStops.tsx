import { useState } from 'react'
import { useDistricts } from '../../../api/districts'
import { messageFor } from '../../../api/errors'
import { useDeleteStop, useSaveStop, useTransitStops } from '../../../api/transit'
import type { TransitStop } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { EntityHistory } from '../../shared/EntityHistory'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { DataTable } from '../../ui/DataTable'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, SearchInput, Select, TextInput, Toggle } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Drawer } from '../../ui/Overlay'
import { Panel } from '../../ui/Panel'
import layout from '../../ui/layout.module.css'
import { LineCode } from './LineCode'

/** F36: the stops of the network; admins create, edit and delete them, agents read. */
export function TransportStops({ admin }: { admin: boolean }) {
  const stops = useTransitStops({})
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<TransitStop | 'new' | null>(null)

  const needle = q.trim().toLowerCase()
  const rows = (stops.data ?? []).filter(
    (stop) => !needle || [stop.name, stop.code, stop.address ?? '', stop.district?.name ?? ''].some((value) => value.toLowerCase().includes(needle)),
  )

  return (
    <Panel
      title="Arrêts"
      kicker={`${stops.data?.length ?? '…'} arrêts`}
      actions={
        admin && (
          <Button size="sm" variant="primary" icon="plus" onClick={() => setEditing('new')}>
            Nouvel arrêt
          </Button>
        )
      }
    >
      <div className={layout.toolbar}>
        <SearchInput label="Rechercher un arrêt" placeholder="Nom, code, quartier…" value={q} onChange={(event) => setQ(event.target.value)} />
      </div>
      {!stops.data ? (
        stops.isError ? <EmptyState title={messageFor(stops.error)} icon="alert" /> : <Skeleton lines={4} />
      ) : (
        <DataTable<TransitStop>
          caption="Arrêts du réseau"
          rows={rows}
          rowKey={(stop) => stop.id}
          onRowClick={admin ? setEditing : undefined}
          initialSort={{ key: 'name', dir: 'asc' }}
          columns={[
            { key: 'name', header: 'Arrêt', sortValue: (stop) => stop.name, cell: (stop) => <strong>{stop.name}</strong> },
            { key: 'code', header: 'Code', hideOnPhone: true, sortValue: (stop) => stop.code, cell: (stop) => stop.code },
            { key: 'district', header: 'Quartier', sortValue: (stop) => stop.district?.name ?? '', cell: (stop) => stop.district?.name ?? '—' },
            {
              key: 'lines',
              header: 'Lignes',
              cell: (stop) =>
                stop.lines.length ? (
                  <span className={layout.row}>
                    {stop.lines.map((line) => (
                      <LineCode key={line.id} line={line} />
                    ))}
                  </span>
                ) : (
                  <span className={layout.muted}>Aucune</span>
                ),
            },
            {
              key: 'access',
              header: 'Accès',
              hideOnPhone: true,
              cell: (stop) => (stop.accessible ? <Tag tone="ok">Accessible</Tag> : <Tag tone="progress">Non adapté</Tag>),
            },
          ]}
        />
      )}
      {editing && <StopDrawer key={editing === 'new' ? 'new' : editing.id} stop={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Panel>
  )
}

function StopDrawer({ stop, onClose }: { stop: TransitStop | null; onClose: () => void }) {
  const districts = useDistricts()
  const save = useSaveStop()
  const remove = useDeleteStop()
  const [code, setCode] = useState(stop?.code ?? '')
  const [name, setName] = useState(stop?.name ?? '')
  const [districtId, setDistrictId] = useState(stop?.district_id ?? 0)
  const [address, setAddress] = useState(stop?.address ?? '')
  const [accessible, setAccessible] = useState(stop?.accessible ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const form = useApiForm({
    labels: { code: 'Code', name: 'Nom', district_id: 'Quartier', address: 'Adresse' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!code.trim()) errors.code = 'Indiquez un code court (ex. GDO).'
      if (!name.trim()) errors.name = 'Indiquez le nom affiché aux habitants.'
      return errors
    },
    submit: () =>
      save.mutateAsync({ id: stop?.id, code: code.trim(), name: name.trim(), district_id: districtId || null, address: address.trim() || null, accessible }),
    onSuccess: (saved) => {
      toast(stop ? `Arrêt ${saved.name} enregistré` : `Arrêt ${saved.name} créé : ajoutez-le à une ligne`)
      onClose()
    },
  })

  const deleteStop = () =>
    stop &&
    remove.mutateAsync(stop.id).then(
      () => {
        toast(`Arrêt ${stop.name} supprimé`)
        onClose()
      },
      (error) => toast(messageFor(error), 'alert'),
    )

  return (
    <Drawer open onClose={onClose} kicker="F36 · Arrêt" title={stop ? stop.name : 'Nouvel arrêt'}>
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
          <Field id={form.fieldId('name')} label="Nom" required error={form.errors.name}>
            {(id, describedBy, invalid) => <TextInput id={id} data-autofocus aria-describedby={describedBy} aria-invalid={invalid} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <Field id={form.fieldId('code')} label="Code" required error={form.errors.code}>
            {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />}
          </Field>
        </div>
        <Field id={form.fieldId('district_id')} label="Quartier" hint="Les habitants de ce quartier voient l’arrêt en premier et sont prévenus des perturbations." error={form.errors.district_id}>
          {(id, describedBy) => (
            <Select id={id} aria-describedby={describedBy} value={districtId} onChange={(event) => setDistrictId(Number(event.target.value))}>
              <option value={0}>Aucun</option>
              {districts.data?.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id={form.fieldId('address')} label="Adresse" error={form.errors.address}>
          {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={address} onChange={(event) => setAddress(event.target.value)} />}
        </Field>
        <Toggle checked={accessible} onChange={setAccessible} label="Accessible en fauteuil (F21)" />
        <div className={layout.row}>
          <Button variant="primary" icon="check" type="submit" disabled={form.pending} aria-busy={form.pending}>
            {stop ? 'Enregistrer' : 'Créer l’arrêt'}
          </Button>
          {stop &&
            (confirmDelete ? (
              <>
                <Button variant="danger" disabled={remove.isPending} onClick={() => void deleteStop()}>
                  Confirmer : le retirer de ses lignes et de leurs horaires
                </Button>
                <Button variant="subtle" onClick={() => setConfirmDelete(false)}>
                  Garder l’arrêt
                </Button>
              </>
            ) : (
              <Button variant="subtle" onClick={() => setConfirmDelete(true)}>
                Supprimer…
              </Button>
            ))}
        </div>
      </form>
      {stop && (
        <div className={layout.stack}>
          <h3 className={layout.sectionLabel}>Historique</h3>
          <EntityHistory entity="TransitStop" entityId={stop.id} />
        </div>
      )}
    </Drawer>
  )
}
