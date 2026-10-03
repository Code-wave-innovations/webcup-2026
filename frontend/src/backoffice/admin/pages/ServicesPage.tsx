import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { categoryName } from '../../lib/lookups'
import { formatNumber } from '../../lib/format'
import { CATEGORIES } from '../../mocks/catalog'
import type { CityService } from '../../mocks/types'
import { updateService, useCatalogStore } from '../../stores/catalogStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, SearchInput, Select, TextArea, TextInput, Toggle } from '../../ui/Controls'
import { Icon } from '../../ui/Icon'
import { Drawer } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { rise, stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

// F28: same order as the backend (featured, then priority, then most viewed)
const homeOrder = (a: CityService, b: CityService) =>
  Number(b.is_featured) - Number(a.is_featured) || b.priority - a.priority || b.view_count - a.view_count

/** D05 / F28: the municipal service catalog and what the home page highlights. */
export default function ServicesPage() {
  const actor = useActor()
  const services = useCatalogStore((s) => s.services)
  const [category, setCategory] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<CityService>>({})

  const q = query.trim().toLowerCase()
  const shown = services
    .filter((s) => category === 'all' || s.category_id === category)
    .filter((s) => !q || `${s.name} ${s.summary}`.toLowerCase().includes(q))
    .sort(homeOrder)
  const home = services.filter((s) => s.is_active).sort(homeOrder).slice(0, 6)
  const editing = services.find((s) => s.id === editingId)

  const openEdit = (s: CityService) => {
    setEditingId(s.id)
    setDraft({ name: s.name, summary: s.summary, category_id: s.category_id, contact_phone: s.contact_phone, address: s.address })
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Catalogue des services"
        codes={['D05', 'F28']}
        lead="Activez, décrivez et mettez en avant les services municipaux. L’étoile place un service en tête de la page d’accueil."
      />

      <div className={[layout.grid, layout.splitWide].join(' ')}>
        <div className={layout.stack}>
          <div className={layout.row}>
            <FilterChips<number | 'all'>
              label="Catégorie"
              value={category}
              onChange={setCategory}
              options={[{ value: 'all', label: 'Toutes', count: services.length }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name, count: services.filter((s) => s.category_id === c.id).length }))]}
            />
          </div>
          <SearchInput label="Rechercher un service (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <motion.div className={styles.catalog} variants={stagger} initial="hidden" animate="show">
            {shown.map((s) => (
              <motion.article
                key={s.id}
                layout
                variants={rise}
                className={[styles.serviceCard, s.is_featured && styles.featured, !s.is_active && styles.inactive].filter(Boolean).join(' ')}
              >
                <div className={styles.serviceHead}>
                  <div>
                    <p className={styles.serviceName}>{s.name}</p>
                    <p className={styles.serviceCat}>{categoryName(s.category_id)}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.star}
                    aria-pressed={s.is_featured}
                    aria-label={s.is_featured ? `Retirer ${s.name} de la mise en avant` : `Mettre en avant ${s.name}`}
                    onClick={() => updateService(s.id, { is_featured: !s.is_featured }, actor.id)}
                  >
                    <Icon name="star" size={18} />
                  </button>
                </div>
                <p className={[layout.muted, layout.small].join(' ')}>{s.summary}</p>
                <div className={styles.serviceMeta}>
                  <span className={styles.views}>
                    <Icon name="eye" size={13} /> {formatNumber(s.view_count)} vues
                  </span>
                  <span className={styles.priority} aria-label={`Priorité ${s.priority}`}>
                    <button type="button" aria-label="Baisser la priorité" onClick={() => updateService(s.id, { priority: Math.max(0, s.priority - 1) }, actor.id)}>
                      <Icon name="arrowDown" size={13} />
                    </button>
                    <strong>{s.priority}</strong>
                    <button type="button" aria-label="Augmenter la priorité" onClick={() => updateService(s.id, { priority: s.priority + 1 }, actor.id)}>
                      <Icon name="arrowUp" size={13} />
                    </button>
                  </span>
                </div>
                <div className={layout.row} style={{ justifyContent: 'space-between' }}>
                  <Toggle checked={s.is_active} onChange={(v) => updateService(s.id, { is_active: v }, actor.id)} label={s.is_active ? 'En ligne' : 'Hors ligne'} />
                  <Button size="sm" variant="subtle" icon="edit" onClick={() => openEdit(s)}>
                    Modifier
                  </Button>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>

        <Panel kicker="F28 · Aperçu" title="Ordre sur la page d’accueil" accent="ember">
          <ol className={styles.sectionList}>
            {home.map((s, i) => (
              <motion.li key={s.id} layout className={styles.sectionItem} transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
                <span className={styles.sectionIndex}>{String(i + 1).padStart(2, '0')}</span>
                {s.is_featured ? <Icon name="star" size={15} style={{ color: 'var(--color-ember)' }} label="Mis en avant" /> : <span />}
                <span>{s.name}</span>
                <Tag tone="neutral">P{s.priority}</Tag>
              </motion.li>
            ))}
          </ol>
          <p className={[layout.muted, layout.small].join(' ')}>Services mis en avant d’abord, puis par priorité, puis par nombre de consultations.</p>
        </Panel>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditingId(null)}
        kicker="D05 · Service"
        title={editing?.name ?? ''}
        footer={
          editing && (
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                updateService(editing.id, draft, actor.id)
                setEditingId(null)
              }}
            >
              Enregistrer
            </Button>
          )
        }
      >
        {editing && (
          <>
            <Field label="Nom">{(id) => <TextInput id={id} value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Résumé" hint="Une phrase : à quoi sert ce service.">
              {(id, d) => <TextArea id={id} aria-describedby={d} value={draft.summary ?? ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />}
            </Field>
            <Field label="Catégorie">
              {(id) => (
                <Select id={id} value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: Number(e.target.value) })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className={layout.formGrid}>
              <Field label="Téléphone">{(id) => <TextInput id={id} value={draft.contact_phone ?? ''} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value || null })} />}</Field>
              <Field label="Adresse">{(id) => <TextInput id={id} value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value || null })} />}</Field>
            </div>
          </>
        )}
      </Drawer>
    </motion.div>
  )
}
