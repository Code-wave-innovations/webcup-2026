import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { messageFor } from '../../../api/errors'
import { useAdminServices, useCreateService, useEnableService, useHomePreview, useServiceCategories, useUpdateService } from '../../../api/services'
import type { CityService, ServiceInput } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { formatDateTime, formatNumber } from '../../lib/format'
import { EntityHistory } from '../../shared/EntityHistory'
import { AvailabilityPill, CutServiceModal, ServicePreview, ServicesStatus } from '../../shared/ServiceState'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, FilterChips, SearchInput, Select, Tabs, TextArea, TextInput, Toggle } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { Drawer, Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { rise, stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'
import { ServiceProcedures } from './ServiceProcedures'

type DrawerTab = 'infos' | 'demarches' | 'etat' | 'apercu' | 'historique'

/** D05 / F28 / F63 / F64: the service catalogue, what the home page highlights, and cutting a faulty service. */
export default function ServicesPage() {
  const services = useAdminServices()
  const categories = useServiceCategories().data ?? []
  const home = useHomePreview()
  const update = useUpdateService()
  const enable = useEnableService()
  const [params, setParams] = useSearchParams()
  const openId = Number(params.get('service')) || null
  // ?couper=<id>: opened from the ⌘K palette (F63)
  const cutId = Number(params.get('couper')) || null
  const [category, setCategory] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [cutting, setCutting] = useState<CityService | null>(null)
  const [withdrawing, setWithdrawing] = useState<CityService | null>(null)
  const [creating, setCreating] = useState(false)

  const openService = (id: number | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('service', String(id))
        else next.delete('service')
        return next
      },
      { replace: true },
    )

  const all = services.data ?? []
  const q = query.trim().toLowerCase()
  const shown = all
    .filter((s) => category === 'all' || s.category_id === category)
    .filter((s) => !q || `${s.name} ${s.summary} ${s.keywords ?? ''}`.toLowerCase().includes(q))
  const open = all.find((s) => s.id === openId) ?? null
  const cutFromPalette = all.find((s) => s.id === cutId) ?? null

  const patch = (service: CityService, changes: ServiceInput, done: string) =>
    update.mutate({ id: service.id, ...changes }, { onSuccess: () => toast(done), onError: (error) => toast(messageFor(error), 'alert') })

  // F28: clicks on the priority arrows are grouped into one change (one save, one audit entry « 2 → 5 »)
  const [pendingPriority, setPendingPriority] = useState<Record<number, number>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])
  const nudgePriority = (service: CityService, delta: number) => {
    const next = Math.max(0, (pendingPriority[service.id] ?? service.priority) + delta)
    setPendingPriority((current) => ({ ...current, [service.id]: next }))
    clearTimeout(timers.current[service.id])
    timers.current[service.id] = setTimeout(() => {
      setPendingPriority((current) => Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== service.id)))
      if (next !== service.priority) patch(service, { priority: next }, `${service.name} : priorité ${service.priority} → ${next}`)
    }, 700)
  }

  const restore = (service: CityService) =>
    enable.mutate(service.id, {
      onSuccess: () => toast(`${service.name} rétabli : de nouveau disponible`),
      onError: (error) => toast(messageFor(error), 'alert'),
    })

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Catalogue des services"
        codes={['D05', 'F28', 'F63', 'F64']}
        lead="Décrivez et mettez en avant les services municipaux. « Couper » rend un service défectueux indisponible tout en le laissant visible, avec le motif et l’alternative."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Nouveau service
          </Button>
        }
      />

      <Panel kicker="F64 · En ce moment" title="État des services">
        {services.data ? <ServicesStatus services={all} /> : <Skeleton lines={2} />}
      </Panel>

      <div className={[layout.grid, layout.splitWide].join(' ')}>
        <div className={layout.stack}>
          <div className={layout.row}>
            <FilterChips<number | 'all'>
              label="Catégorie"
              value={category}
              onChange={setCategory}
              options={[{ value: 'all', label: 'Toutes', count: all.length }, ...categories.map((c) => ({ value: c.id, label: c.name, count: all.filter((s) => s.category_id === c.id).length }))]}
            />
          </div>
          <SearchInput label="Rechercher un service (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          {!services.data ? (
            services.isError ? <EmptyState title={messageFor(services.error)} icon="alert" /> : <Skeleton lines={8} />
          ) : (
            <motion.div className={styles.catalog} variants={stagger} initial="hidden" animate="show">
              {shown.map((s) => {
                const down = s.availability.status === 'UNAVAILABLE'
                return (
                  <motion.article key={s.id} layout variants={rise} className={[styles.serviceCard, s.is_featured && styles.featured, !s.is_active && styles.inactive].filter(Boolean).join(' ')}>
                    <div className={styles.serviceHead}>
                      <div>
                        <p className={styles.serviceName}>{s.name}</p>
                        <p className={styles.serviceCat}>{s.category?.name ?? 'Sans catégorie'}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.star}
                        aria-pressed={s.is_featured}
                        aria-label={s.is_featured ? `Retirer ${s.name} de la mise en avant` : `Mettre en avant ${s.name}`}
                        onClick={() => patch(s, { is_featured: !s.is_featured }, s.is_featured ? `${s.name} n’est plus mis en avant` : `${s.name} mis en avant`)}
                      >
                        <Icon name="star" size={18} />
                      </button>
                    </div>
                    <AvailabilityPill availability={s.availability} />
                    <p className={[layout.muted, layout.small].join(' ')}>{s.summary}</p>
                    <div className={styles.serviceMeta}>
                      <span className={styles.views}>
                        <Icon name="eye" size={13} /> {formatNumber(s.view_count)} consultations
                      </span>
                      <span className={styles.priority} aria-label={`Priorité ${pendingPriority[s.id] ?? s.priority}`}>
                        <button type="button" aria-label={`Baisser la priorité de ${s.name}`} onClick={() => nudgePriority(s, -1)}>
                          <Icon name="arrowDown" size={13} />
                        </button>
                        <strong aria-live="polite">{pendingPriority[s.id] ?? s.priority}</strong>
                        <button type="button" aria-label={`Augmenter la priorité de ${s.name}`} onClick={() => nudgePriority(s, 1)}>
                          <Icon name="arrowUp" size={13} />
                        </button>
                      </span>
                    </div>
                    <div className={layout.row} style={{ justifyContent: 'space-between' }}>
                      <Toggle
                        checked={s.is_active}
                        onChange={(v) => (v ? patch(s, { is_active: true }, `${s.name} de retour dans le catalogue`) : setWithdrawing(s))}
                        label={s.is_active ? 'Dans le catalogue' : 'Retiré du catalogue'}
                      />
                      <span className={layout.row}>
                        {down ? (
                          <Button size="sm" icon="power" onClick={() => restore(s)} disabled={enable.isPending}>
                            Rétablir
                          </Button>
                        ) : (
                          <Button size="sm" variant="danger" icon="power" onClick={() => setCutting(s)} disabled={!s.is_active}>
                            Couper
                          </Button>
                        )}
                        <Button size="sm" variant="subtle" icon="edit" onClick={() => openService(s.id)}>
                          Modifier
                        </Button>
                      </span>
                    </div>
                  </motion.article>
                )
              })}
            </motion.div>
          )}
        </div>

        <Panel kicker="F28 · Aperçu" title="Ordre sur la page d’accueil" accent="ember">
          {home.data ? (
            <ol className={styles.sectionList}>
              {home.data.featured_services.map((s, i) => (
                <motion.li key={s.id} layout className={styles.sectionItem} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
                  <span className={styles.sectionIndex}>{String(i + 1).padStart(2, '0')}</span>
                  {s.is_featured ? <Icon name="star" size={15} style={{ color: 'var(--color-ember)' }} label="Mis en avant" /> : <span />}
                  <span>{s.name}</span>
                  <Tag tone="neutral">P{s.priority}</Tag>
                </motion.li>
              ))}
            </ol>
          ) : (
            <Skeleton lines={6} />
          )}
          <p className={[layout.muted, layout.small].join(' ')}>Exactement ce que l’habitant voit sur l’accueil : mis en avant d’abord, puis par priorité, puis par consultations.</p>
        </Panel>
      </div>

      <Drawer open={open !== null} onClose={() => openService(null)} kicker="D05 · Service" title={open?.name ?? ''}>
        {open && <ServiceDrawer key={open.id} service={open} onCut={() => setCutting(open)} onRestore={() => restore(open)} />}
      </Drawer>

      <CutServiceModal
        service={cutting ?? cutFromPalette}
        onClose={() => {
          setCutting(null)
          if (cutId)
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('couper')
                return next
              },
              { replace: true },
            )
        }}
      />

      <Modal
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        kicker="Retirer du catalogue"
        title={`Retirer « ${withdrawing?.name ?? ''} » ?`}
        footer={
          <>
            <Button variant="subtle" onClick={() => setWithdrawing(null)}>
              Annuler
            </Button>
            {withdrawing && withdrawing.availability.status !== 'UNAVAILABLE' && (
              <Button
                variant="danger"
                icon="power"
                onClick={() => {
                  setCutting(withdrawing)
                  setWithdrawing(null)
                }}
              >
                Plutôt couper le service
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                if (withdrawing) patch(withdrawing, { is_active: false }, `${withdrawing.name} retiré du catalogue`)
                setWithdrawing(null)
              }}
            >
              Retirer du catalogue
            </Button>
          </>
        }
      >
        <p>Le service disparaîtra pour les habitants. Pour une panne, utilisez plutôt « Couper le service » : il reste visible, avec le motif, l’alternative et l’heure de retour.</p>
      </Modal>

      <CreateServiceModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => openService(id)} />
    </motion.div>
  )
}

function ServiceDrawer({ service, onCut, onRestore }: { service: CityService; onCut: () => void; onRestore: () => void }) {
  const [tab, setTab] = useState<DrawerTab>('infos')
  const { availability } = service
  return (
    <div className={layout.stack}>
      <div className={layout.row} style={{ justifyContent: 'space-between' }}>
        <AvailabilityPill availability={availability} />
        {availability.status === 'UNAVAILABLE' ? (
          <Button size="sm" icon="power" onClick={onRestore}>
            Rétablir le service
          </Button>
        ) : (
          <Button size="sm" variant="danger" icon="power" onClick={onCut} disabled={!service.is_active}>
            Couper le service
          </Button>
        )}
      </div>
      <Tabs<DrawerTab>
        label="Sections du service"
        idPrefix="service"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'infos', label: 'Informations' },
          { value: 'demarches', label: 'Démarches', count: service._count?.procedures },
          { value: 'etat', label: 'État' },
          { value: 'apercu', label: 'Aperçu habitant' },
          { value: 'historique', label: 'Historique' },
        ]}
      />
      <div id="service-panel" role="tabpanel" aria-labelledby={`service-tab-${tab}`} className={layout.stack}>
        {tab === 'infos' && <ServiceInfoForm service={service} />}
        {tab === 'demarches' && <ServiceProcedures serviceId={service.id} />}
        {tab === 'etat' && (
          <>
            {availability.current ? (
              <dl className={layout.dl}>
                <dt>En cours</dt>
                <dd>{availability.current.reason}</dd>
                <dt>Depuis</dt>
                <dd>{formatDateTime(availability.current.starts_at)}</dd>
                <dt>Retour</dt>
                <dd>{availability.back_at ? formatDateTime(availability.back_at) : 'Jusqu’à nouvel ordre'}</dd>
                {availability.current.alternative && (
                  <>
                    <dt>Alternative</dt>
                    <dd>{availability.current.alternative}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p>Aucune interruption en cours.</p>
            )}
            <p className={layout.sectionLabel}>À venir</p>
            {availability.upcoming.length === 0 ? (
              <p className={layout.muted}>Aucune interruption prévue.</p>
            ) : (
              <ul>
                {availability.upcoming.map((i) => (
                  <li key={i.id}>
                    {formatDateTime(i.starts_at)}
                    {i.ends_at ? ` → ${formatDateTime(i.ends_at)}` : ''} · {i.reason}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/maintenance">Gérer les interruptions</Link>
          </>
        )}
        {tab === 'apercu' && <ServicePreview service={service} />}
        {tab === 'historique' && <EntityHistory entity="CityService" entityId={service.id} />}
      </div>
    </div>
  )
}

const FIELDS: { key: keyof ServiceInput; label: string; long?: boolean; hint?: string }[] = [
  { key: 'name', label: 'Nom' },
  { key: 'summary', label: 'Résumé', long: true },
  { key: 'description', label: 'Description', long: true },
  { key: 'keywords', label: 'Mots-clés de recherche', hint: 'Séparés par des virgules : ils aident l’habitant à trouver le service (F32).' },
  { key: 'contact_phone', label: 'Téléphone' },
  { key: 'contact_email', label: 'E-mail' },
  { key: 'address', label: 'Adresse' },
  { key: 'opening_hours', label: 'Horaires' },
  { key: 'external_url', label: 'Lien externe' },
]

function ServiceInfoForm({ service }: { service: CityService }) {
  const update = useUpdateService()
  const categories = useServiceCategories().data ?? []
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(service[f.key as keyof CityService] ?? '')])))
  const [categoryId, setCategoryId] = useState(service.category_id)

  const form = useApiForm({
    labels: Object.fromEntries(FIELDS.map((f) => [f.key, f.label])),
    submit: () =>
      update.mutateAsync({
        id: service.id,
        category_id: categoryId,
        ...Object.fromEntries(FIELDS.map((f) => [f.key, f.key === 'name' || f.key === 'summary' ? draft[f.key].trim() : draft[f.key].trim() || null])),
      }),
    onSuccess: () => toast(`${service.name} enregistré`),
  })

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
      <Field label="Catégorie">
        {(id) => (
          <Select id={id} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Sans catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {FIELDS.map((f) => (
        <Field key={f.key} id={form.fieldId(f.key)} label={f.label} hint={f.hint} error={form.errors[f.key]} required={f.key === 'name' || f.key === 'summary'}>
          {(id, describedBy, invalid) =>
            f.long ? (
              <TextArea id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            ) : (
              <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            )
          }
        </Field>
      ))}
      <Button type="submit" variant="primary" icon="check" disabled={form.pending} aria-busy={form.pending}>
        Enregistrer
      </Button>
    </form>
  )
}

function CreateServiceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const create = useCreateService()
  const categories = useServiceCategories().data ?? []
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const form = useApiForm({
    labels: { name: 'Nom', summary: 'Résumé' },
    submit: () => create.mutateAsync({ name: name.trim(), summary: summary.trim(), category_id: categoryId }),
    onSuccess: (service) => {
      toast(`Service « ${service.name} » créé`)
      setName('')
      setSummary('')
      onClose()
      onCreated(service.id)
    },
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="D05"
      title="Nouveau service"
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="plus" type="submit" form="create-service" disabled={form.pending} aria-busy={form.pending}>
            Créer
          </Button>
        </>
      }
    >
      <form
        id="create-service"
        noValidate
        className={layout.stack}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field id={form.fieldId('name')} label="Nom" required error={form.errors.name}>
          {(id, describedBy, invalid) => <TextInput id={id} data-autofocus aria-describedby={describedBy} aria-invalid={invalid} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('summary')} label="Résumé" required error={form.errors.summary}>
          {(id, describedBy, invalid) => <TextArea id={id} aria-describedby={describedBy} aria-invalid={invalid} value={summary} onChange={(e) => setSummary(e.target.value)} />}
        </Field>
        <Field label="Catégorie">
          {(id) => (
            <Select id={id} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}
