import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { AUDIENCE_LABEL } from '../../lib/labels'
import { formatDateTime, formatRelative } from '../../lib/format'
import { districtName, fullName, useUsersById } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import { DISTRICTS } from '../../mocks/people'
import type { Broadcast } from '../../mocks/types'
import { estimateAudience, sendBroadcast, useContentStore } from '../../stores/contentStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, TextArea, TextInput } from '../../ui/Controls'
import { DataTable, type Column } from '../../ui/DataTable'
import { ProgressBar } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

type Audience = Broadcast['audience']

/** F30: global notifications — compose, target, and follow how many people read them. */
export default function NotificationsPage() {
  const actor = useActor()
  const now = useNow()
  const users = useUsersById()
  const broadcasts = useContentStore((s) => s.broadcasts)
  const [form, setForm] = useState({ title: '', body: '', audience: 'ALL' as Audience, district_ids: [] as number[] })
  const reach = estimateAudience(form.audience, form.district_ids)
  const sent = broadcasts.reduce((sum, b) => sum + b.recipients, 0)
  const readRate = broadcasts.length ? broadcasts.reduce((sum, b) => sum + b.read_rate, 0) / broadcasts.length : 0

  const columns: Column<Broadcast>[] = [
    {
      key: 'title',
      header: 'Notification',
      sortValue: (b) => b.title,
      cell: (b) => (
        <span>
          <span className={layout.strong}>{b.title}</span>
          <span className={[layout.muted, layout.small].join(' ')} style={{ display: 'block' }}>
            {b.body}
          </span>
        </span>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      cell: (b) => (
        <Tag tone={b.audience === 'STAFF' ? 'taken' : b.audience === 'ALL' ? 'ice' : 'progress'}>
          {AUDIENCE_LABEL[b.audience]}
          {b.district_ids.length > 0 && ` · ${b.district_ids.map(districtName).join(', ')}`}
        </Tag>
      ),
    },
    { key: 'recipients', header: 'Destinataires', align: 'end', sortValue: (b) => b.recipients, cell: (b) => b.recipients.toLocaleString('fr-FR') },
    {
      key: 'read',
      header: 'Lues',
      hideOnPhone: true,
      sortValue: (b) => b.read_rate,
      cell: (b) => (
        <span className={styles.coverage}>
          <ProgressBar value={b.read_rate} tone={b.read_rate > 0.7 ? 'ok' : 'progress'} label={`Taux de lecture ${Math.round(b.read_rate * 100)} %`} />
          <small>{Math.round(b.read_rate * 100)} %</small>
        </span>
      ),
    },
    {
      key: 'sent',
      header: 'Envoyée',
      sortValue: (b) => -new Date(b.sent_at).getTime(),
      cell: (b) => (
        <span className={layout.small} title={formatDateTime(b.sent_at)}>
          {formatRelative(b.sent_at, now)} · {fullName(users.get(b.author_id))}
        </span>
      ),
    },
  ]

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Notifications globales"
        lead="Maquette locale : les envois ne touchent pas l’API. Prévenez les habitants au bon moment ; annonces importantes et alertes déclencheront aussi des notifications une fois branché."
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Notifications envoyées" value={sent} icon="send" tone="ice" />
        <StatTile label="Taux de lecture moyen" value={Math.round(readRate * 100)} unit="%" icon="eye" tone="ok" />
        <StatTile label="Diffusions" value={broadcasts.length} icon="bell" tone="taken" />
      </motion.div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="Historique" title="Diffusions" flush>
          <DataTable caption="Historique des notifications globales" columns={columns} rows={broadcasts} rowKey={(b) => b.id} initialSort={{ key: 'sent', dir: 'asc' }} />
        </Panel>

        <Panel kicker="Composer" title="Nouvelle notification" accent="ice">
          <Field label="Titre">{(id) => <TextInput id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
          <Field label="Message">{(id) => <TextArea id={id} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}</Field>
          <p className={layout.sectionLabel}>Destinataires</p>
          <FilterChips<Audience>
            label="Destinataires"
            value={form.audience}
            onChange={(audience) => setForm({ ...form, audience })}
            options={(['ALL', 'DISTRICTS', 'VULNERABLE', 'STAFF'] as const).map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))}
          />
          {(form.audience === 'DISTRICTS' || form.audience === 'VULNERABLE') && (
            <FilterChips<number>
              label="Quartier"
              value={form.district_ids[0] ?? 0}
              onChange={(id) => setForm((f) => ({ ...f, district_ids: f.district_ids.includes(id) ? f.district_ids.filter((d) => d !== id) : [...f.district_ids, id] }))}
              options={DISTRICTS.map((d) => ({ value: d.id, label: `${form.district_ids.includes(d.id) ? '✓ ' : ''}${d.name}` }))}
            />
          )}
          <div className={styles.preview}>
            <span className={styles.previewLabel}>Aperçu</span>
            <div className={layout.row} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <Icon name="bell" size={20} style={{ color: 'var(--color-ice)', flex: 'none' }} />
              <div>
                <p className={layout.strong}>{form.title || 'Titre de la notification'}</p>
                <p className={[layout.muted, layout.small].join(' ')}>{form.body || 'Message court et actionnable.'}</p>
              </div>
            </div>
          </div>
          <p className={layout.small}>
            Sera envoyée à <strong>{reach.toLocaleString('fr-FR')}</strong> personne{reach > 1 ? 's' : ''}.
          </p>
          <Button
            variant="primary"
            icon="send"
            disabled={!form.title.trim() || !form.body.trim() || (form.audience === 'DISTRICTS' && form.district_ids.length === 0)}
            onClick={() => {
              sendBroadcast({ title: form.title.trim(), body: form.body.trim(), audience: form.audience, district_ids: form.district_ids }, actor.id)
              setForm({ title: '', body: '', audience: 'ALL', district_ids: [] })
            }}
          >
            Envoyer
          </Button>
        </Panel>
      </div>
    </motion.div>
  )
}
