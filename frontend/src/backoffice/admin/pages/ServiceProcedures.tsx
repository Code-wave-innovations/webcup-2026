import { useState } from 'react'
import { messageFor } from '../../../api/errors'
import { useDeleteProcedure, useProcedures, useSaveProcedure } from '../../../api/procedures'
import type { FormField, Procedure } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, Select, TextArea, TextInput, Toggle } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Nombre' },
  { value: 'select', label: 'Liste de choix' },
  { value: 'email', label: 'E-mail' },
  { value: 'tel', label: 'Téléphone' },
  { value: 'checkbox', label: 'Case à cocher' },
]

/** « Nom complet » → full_name_1: the server wants snake_case names */
const fieldName = (label: string, index: number) =>
  `${
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'f_$1') || 'champ'
  }_${index + 1}`

/** D05 / D11: the procedures of a service, with the fields of their online form */
export function ServiceProcedures({ serviceId }: { serviceId: number }) {
  const list = useProcedures(serviceId)
  const [editing, setEditing] = useState<Procedure | 'new' | null>(null)
  if (list.isError) return <EmptyState title={messageFor(list.error)} icon="alert" />
  if (!list.data) return <Skeleton lines={4} />
  if (editing) return <ProcedureForm key={editing === 'new' ? 'new' : editing.id} serviceId={serviceId} procedure={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
  return (
    <div className={layout.stack}>
      {list.data.length === 0 ? (
        <EmptyState title="Aucune démarche en ligne" icon="file" />
      ) : (
        <ul className={layout.stack} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.data.map((p) => (
            <li key={p.id} className={layout.row} style={{ justifyContent: 'space-between' }}>
              <span>
                <strong>{p.title}</strong>{' '}
                <span className={[layout.muted, layout.small].join(' ')}>
                  {(p.form_schema ?? []).length} champ(s){p.estimated_days !== null ? ` · ${p.estimated_days} j` : ''}
                </span>{' '}
                {!p.is_active && <Tag tone="neutral">Hors ligne</Tag>}
              </span>
              <Button size="sm" icon="edit" onClick={() => setEditing(p)}>
                Modifier
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button icon="plus" onClick={() => setEditing('new')}>
        Nouvelle démarche
      </Button>
    </div>
  )
}

function ProcedureForm({ serviceId, procedure, onDone }: { serviceId: number; procedure: Procedure | null; onDone: () => void }) {
  const save = useSaveProcedure()
  const remove = useDeleteProcedure()
  const [title, setTitle] = useState(procedure?.title ?? '')
  const [description, setDescription] = useState(procedure?.description ?? '')
  const [documents, setDocuments] = useState((procedure?.required_documents ?? []).join('\n'))
  const [days, setDays] = useState(procedure?.estimated_days?.toString() ?? '')
  const [active, setActive] = useState(procedure?.is_active ?? true)
  const [fields, setFields] = useState<FormField[]>(procedure?.form_schema ?? [])

  const form = useApiForm({
    labels: { title: 'Titre', description: 'Description', estimated_days: 'Délai estimé', form_schema: 'Champs du formulaire' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!title.trim()) errors.title = 'Donnez un titre à la démarche.'
      if (fields.some((f) => !f.label.trim())) errors.form_schema = 'Chaque champ a besoin d’un libellé.'
      if (fields.some((f) => f.type === 'select' && !(f.options ?? []).length)) errors.form_schema = 'Une liste de choix a besoin d’options.'
      return errors
    },
    submit: () =>
      save.mutateAsync({
        id: procedure?.id,
        service_id: serviceId,
        title: title.trim(),
        description: description.trim() || null,
        required_documents: documents.split('\n').map((d) => d.trim()).filter(Boolean),
        estimated_days: days === '' ? null : Number(days),
        is_active: active,
        form_schema: fields.map((f, i) => ({ ...f, name: f.name || fieldName(f.label, i), label: f.label.trim() })),
      }),
    onSuccess: () => {
      toast(procedure ? 'Démarche enregistrée' : 'Démarche créée')
      onDone()
    },
  })

  const setField = (index: number, change: Partial<FormField>) => setFields(fields.map((f, i) => (i === index ? { ...f, ...change } : f)))

  return (
    <form
      noValidate
      className={layout.stack}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit(undefined)
      }}
    >
      <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
      <Field id={form.fieldId('title')} label="Titre" required error={form.errors.title}>
        {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field id={form.fieldId('description')} label="Description" error={form.errors.description}>
        {(id) => <TextArea id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className={layout.formGrid}>
        <Field label="Documents à fournir" hint="Un par ligne.">
          {(id, describedBy) => <TextArea id={id} aria-describedby={describedBy} value={documents} onChange={(e) => setDocuments(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('estimated_days')} label="Délai estimé (jours)" error={form.errors.estimated_days}>
          {(id) => <TextInput id={id} type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />}
        </Field>
      </div>
      <Toggle checked={active} onChange={setActive} label="Démarche en ligne (visible des habitants)" />

      <fieldset className={styles.fieldEditor} id={form.fieldId('form_schema')} tabIndex={-1}>
        <legend>Champs du formulaire</legend>
        {form.errors.form_schema && <p role="alert">{form.errors.form_schema}</p>}
        {fields.length === 0 && <p className={layout.muted}>Aucun champ : l’habitant n’écrit que son message.</p>}
        {fields.map((field, index) => (
          <div key={index} className={styles.fieldRow}>
            <TextInput aria-label={`Libellé du champ ${index + 1}`} placeholder="Libellé" value={field.label} onChange={(e) => setField(index, { label: e.target.value })} />
            <Select aria-label={`Type du champ ${index + 1}`} value={field.type} onChange={(e) => setField(index, { type: e.target.value as FormField['type'] })}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Toggle checked={field.required} onChange={(value) => setField(index, { required: value })} label="Obligatoire" />
            <Button size="sm" variant="subtle" icon="close" onClick={() => setFields(fields.filter((_, i) => i !== index))}>
              Retirer
            </Button>
            {field.type === 'select' && (
              <TextInput
                aria-label={`Options du champ ${index + 1}, séparées par des virgules`}
                placeholder="Options, séparées par des virgules"
                value={(field.options ?? []).join(', ')}
                onChange={(e) => setField(index, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
              />
            )}
          </div>
        ))}
        <Button size="sm" icon="plus" onClick={() => setFields([...fields, { name: '', label: '', type: 'text', required: false }])}>
          Ajouter un champ
        </Button>
      </fieldset>

      <div className={layout.row}>
        <Button type="submit" variant="primary" icon="check" disabled={form.pending} aria-busy={form.pending}>
          Enregistrer
        </Button>
        <Button variant="subtle" onClick={onDone}>
          Annuler
        </Button>
        {procedure && (
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(procedure.id, {
                onSuccess: () => {
                  toast('Démarche supprimée')
                  onDone()
                },
                onError: (error) => toast(messageFor(error), 'alert'),
              })
            }
          >
            Supprimer
          </Button>
        )}
      </div>
    </form>
  )
}
