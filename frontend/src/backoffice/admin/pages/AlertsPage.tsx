import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { AUDIENCE_LABEL, SEVERITY_LABEL, SEVERITY_TONE } from '../../lib/labels'
import { formatRelative } from '../../lib/format'
import { districtName } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import type { AlertAudience, AlertSeverity } from '../../mocks/types'
import { DistrictMap } from '../../shared/DistrictMap'
import { closeAlert, createAlert, estimateAudience, useContentStore } from '../../stores/contentStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, TextArea, TextInput } from '../../ui/Controls'
import { EmptyState } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { AnimatedNumber } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const SEVERITY_COLOR: Record<AlertSeverity, string> = { INFO: 'var(--color-ice)', WARNING: 'var(--color-progress)', CRITICAL: 'var(--color-alert)' }

const TEMPLATES = [
  { label: 'Inondation', category: 'FLOOD', severity: 'CRITICAL' as const, audience: 'DISTRICTS' as const, title: 'Montée des eaux', instructions: 'Évitez les berges et les sous-sols, montez dans les étages.' },
  { label: 'Canicule', category: 'HEATWAVE', severity: 'WARNING' as const, audience: 'VULNERABLE' as const, title: 'Vague de chaleur', instructions: 'Restez au frais, hydratez-vous régulièrement.' },
  { label: 'Message général', category: 'GENERAL', severity: 'INFO' as const, audience: 'ALL' as const, title: 'Message du Haut Conseil', instructions: '' },
]

/** D18 / F29 / F31: compose and broadcast an alert to exactly the people concerned. */
export default function AlertsPage() {
  const actor = useActor()
  const now = useNow()
  const alerts = useContentStore((s) => s.alerts)
  const [form, setForm] = useState({
    title: '',
    message: '',
    category: 'GENERAL',
    severity: 'WARNING' as AlertSeverity,
    audience: 'ALL' as AlertAudience,
    district_ids: [] as number[],
    instructions: '',
    recommendations: [] as string[],
    reco: '',
    source: 'Haut Conseil de la Ville',
  })

  const reach = estimateAudience(form.audience, form.district_ids)
  const active = alerts.filter((a) => a.is_active)
  const past = alerts.filter((a) => !a.is_active)
  const canSend = form.title.trim() && form.message.trim() && (form.audience !== 'DISTRICTS' || form.district_ids.length > 0)

  const toggleDistrict = (id: number) =>
    setForm((f) => ({ ...f, district_ids: f.district_ids.includes(id) ? f.district_ids.filter((d) => d !== id) : [...f.district_ids, id] }))

  const send = () => {
    createAlert(
      {
        title: form.title.trim(),
        message: form.message.trim(),
        category: form.category,
        severity: form.severity,
        audience: form.audience,
        district_ids: form.audience === 'ALL' ? [] : form.district_ids,
        instructions: form.instructions.trim() || null,
        recommendations: form.recommendations,
        source: form.source || null,
      },
      actor.id,
    )
    setForm((f) => ({ ...f, title: '', message: '', instructions: '', recommendations: [], district_ids: [] }))
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Alertes & communications"
        codes={['D18', 'F29', 'F31']}
        lead="Diffusez une alerte à tous, à des quartiers précis ou aux personnes vulnérables, avec des consignes claires et visibles au bon moment."
      />

      {active.length > 0 && (
        <div className={[layout.grid, layout.cols2].join(' ')}>
          {active.map((a) => (
            <Panel
              key={a.id}
              kicker={`${a.category} · depuis ${formatRelative(a.starts_at, now).replace('il y a ', '')}`}
              title={a.title}
              accent={a.severity === 'CRITICAL' ? 'alert' : 'ember'}
              actions={
                <Button size="sm" icon="check" onClick={() => closeAlert(a.id, actor.id)}>
                  Terminer
                </Button>
              }
            >
              <div className={layout.row}>
                <Tag tone={SEVERITY_TONE[a.severity]} pulse={a.severity === 'CRITICAL'}>
                  {SEVERITY_LABEL[a.severity]}
                </Tag>
                <Tag tone="neutral">
                  {AUDIENCE_LABEL[a.audience]}
                  {a.district_ids.length > 0 && ` · ${a.district_ids.map(districtName).join(', ')}`}
                </Tag>
              </div>
              <p>{a.instructions ?? a.message}</p>
              <p className={[layout.muted, layout.small].join(' ')}>
                {a.notified.toLocaleString('fr-FR')} personnes notifiées · source : {a.source ?? '—'}
              </p>
            </Panel>
          ))}
        </div>
      )}

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="Composer" title="Nouvelle alerte" accent="alert">
          <div className={layout.row}>
            <span className={layout.sectionLabel}>Modèles</span>
            {TEMPLATES.map((t) => (
              <Button
                key={t.label}
                size="sm"
                variant="subtle"
                onClick={() => setForm((f) => ({ ...f, category: t.category, severity: t.severity, audience: t.audience, title: t.title, instructions: t.instructions }))}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className={layout.formGrid}>
            <Field label="Titre">{(id) => <TextInput id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
            <Field label="Catégorie">{(id) => <TextInput id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })} />}</Field>
          </div>
          <Field label="Message">{(id) => <TextArea id={id} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />}</Field>
          <Field label="Ce que les habitants doivent faire" hint="Affiché en évidence dans le bandeau.">
            {(id, d) => <TextArea id={id} aria-describedby={d} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />}
          </Field>

          <p className={layout.sectionLabel}>Gravité</p>
          <FilterChips<AlertSeverity>
            label="Gravité"
            value={form.severity}
            onChange={(severity) => setForm({ ...form, severity })}
            options={(['INFO', 'WARNING', 'CRITICAL'] as const).map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))}
          />

          <p className={layout.sectionLabel}>Audience</p>
          <FilterChips<AlertAudience>
            label="Audience"
            value={form.audience}
            onChange={(audience) => setForm({ ...form, audience })}
            options={(['ALL', 'DISTRICTS', 'VULNERABLE'] as const).map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))}
          />
          {form.audience !== 'ALL' && (
            <DistrictMap
              label="Choisir les quartiers concernés"
              selected={form.district_ids}
              onToggle={toggleDistrict}
            />
          )}
          {form.audience === 'VULNERABLE' && (
            <>
              <p className={layout.sectionLabel}>Recommandations adaptées (F31)</p>
              <div className={layout.row}>
                <TextInput aria-label="Nouvelle recommandation" value={form.reco} onChange={(e) => setForm({ ...form, reco: e.target.value })} placeholder="Ex. : Personnes âgées : buvez toutes les heures." />
                <Button
                  size="sm"
                  icon="plus"
                  disabled={!form.reco.trim()}
                  onClick={() => setForm((f) => ({ ...f, recommendations: [...f.recommendations, f.reco.trim()], reco: '' }))}
                >
                  Ajouter
                </Button>
              </div>
            </>
          )}
        </Panel>

        <div className={layout.stack}>
          <Panel kicker="Portée" title="Personnes notifiées">
            <p style={{ font: '500 40px/1 var(--font-display)' }}>
              <AnimatedNumber value={reach} />
            </p>
            <p className={[layout.muted, layout.small].join(' ')}>
              {AUDIENCE_LABEL[form.audience]}
              {form.audience !== 'ALL' && (form.district_ids.length ? ` · ${form.district_ids.map(districtName).join(', ')}` : ' · toute la ville')}
            </p>
          </Panel>
          <Panel kicker="Aperçu" title="Bandeau côté habitant">
            <div className={styles.banner} style={{ ['--tone' as string]: SEVERITY_COLOR[form.severity] }} role="img" aria-label="Aperçu du bandeau d’alerte">
              <Icon name={form.severity === 'INFO' ? 'info' : 'alert'} size={22} />
              <div>
                <strong>{form.title || 'Titre de l’alerte'}</strong>
                <p>{form.instructions || form.message || 'Consignes pour les habitants.'}</p>
                {form.recommendations.length > 0 && (
                  <ul className={styles.reco}>
                    {form.recommendations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Button variant={form.severity === 'CRITICAL' ? 'danger' : 'primary'} icon="siren" disabled={!canSend} onClick={send}>
              Diffuser l’alerte
            </Button>
          </Panel>
        </div>
      </div>

      <Panel kicker="Historique" title="Alertes terminées">
        {past.length === 0 ? (
          <EmptyState title="Aucune alerte terminée" icon="siren" />
        ) : (
          <ul className={styles.sectionList}>
            {past.map((a) => (
              <li key={a.id} className={styles.sectionItem}>
                <Tag tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Tag>
                <span />
                <span>{a.title}</span>
                <small className={layout.muted}>{a.notified.toLocaleString('fr-FR')} notifiés</small>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </motion.div>
  )
}
