import { useState } from 'react'
import { motion } from 'motion/react'
import { LOCALES } from '../../mocks/config'
import type { TranslationEntry } from '../../mocks/types'
import { saveTranslation, useConfigStore } from '../../stores/configStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, TextInput } from '../../ui/Controls'
import { DataTable, type Column } from '../../ui/DataTable'
import { ProgressBar } from '../../ui/Feedback'
import { Drawer } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const ENTITY_LABEL: Record<string, string> = {
  CityService: 'Service',
  ServiceCategory: 'Catégorie',
  Procedure: 'Démarche',
  Alert: 'Alerte',
  Announcement: 'Annonce',
}

const coverageOf = (entry: TranslationEntry, locale: string) => {
  const fields = Object.keys(entry.fields)
  return fields.filter((f) => entry.translations[locale]?.[f]).length / fields.length
}

/** D14 / F27: essential content in several languages, with completeness per language. */
export default function TranslationsPage() {
  const entries = useConfigStore((s) => s.translations)
  const enabled = useConfigStore((s) => s.settings.enabled_locales).filter((l) => l !== 'fr')
  const [locale, setLocale] = useState(enabled[0] ?? 'en')
  const [editing, setEditing] = useState<TranslationEntry | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const average = (code: string) => entries.reduce((sum, e) => sum + coverageOf(e, code), 0) / Math.max(1, entries.length)

  const columns: Column<TranslationEntry>[] = [
    { key: 'type', header: 'Type', cell: (e) => <Tag tone="neutral">{ENTITY_LABEL[e.entity] ?? e.entity}</Tag>, sortValue: (e) => e.entity },
    { key: 'label', header: 'Contenu (fr)', cell: (e) => <span className={layout.strong}>{e.label}</span>, sortValue: (e) => e.label },
    ...enabled.map((code) => ({
      key: code,
      header: code.toUpperCase(),
      sortValue: (e: TranslationEntry) => coverageOf(e, code),
      cell: (e: TranslationEntry) => {
        const ratio = coverageOf(e, code)
        return (
          <span className={styles.coverage}>
            <ProgressBar value={ratio} tone={ratio === 1 ? 'ok' : ratio > 0 ? 'progress' : 'alert'} label={`${code} : ${Math.round(ratio * 100)} %`} />
            <small>{ratio === 1 ? 'Complet' : ratio > 0 ? `${Math.round(ratio * 100)} %` : 'À traduire'}</small>
          </span>
        )
      },
    })),
  ]

  const open = (entry: TranslationEntry) => {
    setEditing(entry)
    setDraft({ ...entry.translations[locale] })
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Contenus multilingues"
        codes={['D14', 'F27']}
        lead="Le français est la langue source. Traduisez les contenus essentiels : services, démarches, alertes et annonces."
      />

      <motion.div className={layout.stats} variants={stagger}>
        {enabled.map((code) => (
          <StatTile
            key={code}
            label={LOCALES.find((l) => l.code === code)?.label ?? code}
            value={Math.round(average(code) * 100)}
            unit="%"
            icon="globe"
            tone={average(code) > 0.7 ? 'ok' : 'progress'}
            hint="contenus traduits"
          />
        ))}
      </motion.div>

      <Panel
        kicker="Matrice"
        title="Couverture par langue"
        flush
        actions={
          <FilterChips<string>
            label="Langue à éditer"
            value={locale}
            onChange={setLocale}
            options={enabled.map((code) => ({ value: code, label: code.toUpperCase() }))}
          />
        }
      >
        <DataTable caption="Couverture des traductions" columns={columns} rows={entries} rowKey={(e) => `${e.entity}-${e.entity_id}`} onRowClick={open} />
      </Panel>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        kicker={`${editing ? (ENTITY_LABEL[editing.entity] ?? editing.entity) : ''} · fr → ${locale}`}
        title={editing?.label ?? ''}
        footer={
          editing && (
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                saveTranslation(editing.entity, editing.entity_id, locale, draft)
                setEditing(null)
              }}
            >
              Enregistrer ({locale.toUpperCase()})
            </Button>
          )
        }
      >
        {editing &&
          Object.entries(editing.fields).map(([field, source]) => (
            <div key={field} className={styles.sideBySide}>
              <div>
                <p className={layout.sectionLabel}>{field} · FR</p>
                <p className={styles.source}>{source}</p>
              </div>
              <Field label={`${field} · ${locale.toUpperCase()}`}>
                {(id) => <TextInput id={id} value={draft[field] ?? ''} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} placeholder="Traduction…" />}
              </Field>
            </div>
          ))}
      </Drawer>
    </motion.div>
  )
}
