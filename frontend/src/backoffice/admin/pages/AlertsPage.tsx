import { useState } from 'react'
import { motion } from 'motion/react'
import { useAlertAudience, useAlerts, useCloseAlert, useCreateAlert } from '../../../api/alerts'
import { useDistricts } from '../../../api/districts'
import { messageFor } from '../../../api/errors'
import type { AlertAudience, AlertRecommendation, AlertSeverity, CityAlert } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { recommendationsOf, stepsOf } from '../../../lib/alertText'
import { AUDIENCE_LABEL, SEVERITY_LABEL, SEVERITY_TONE } from '../../lib/labels'
import { formatDateTime, formatRelative, fromLocalInput, toLocalInput } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { DistrictMap } from '../../shared/DistrictMap'
import { EntityHistory } from '../../shared/EntityHistory'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, TextArea, TextInput, Toggle } from '../../ui/Controls'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon, type IconName } from '../../ui/Icon'
import { Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { AnimatedNumber } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const SEVERITY_ICON: Record<AlertSeverity, IconName> = { INFO: 'info', WARNING: 'alert', CRITICAL: 'siren' }
/** the residents' wording (the back-office keeps its shorter labels) */
const CITIZEN_LEVEL: Record<AlertSeverity, string> = { INFO: 'Information', WARNING: 'Vigilance', CRITICAL: 'Alerte critique' }

type When = 'now' | 'later'
type Duration = '1' | '6' | '24' | '72' | 'none' | 'custom'
const DURATIONS: { value: Duration; label: string }[] = [
  { value: '1', label: '1 h' },
  { value: '6', label: '6 h' },
  { value: '24', label: '24 h' },
  { value: '72', label: '3 jours' },
  { value: 'none', label: 'Jusqu’à clôture' },
  { value: 'custom', label: 'Date précise' },
]

interface Template {
  label: string
  category: string
  severity: AlertSeverity
  audience: AlertAudience
  title: string
  message: string
  instructions: string
  recommendations: AlertRecommendation[]
}

const TEMPLATES: Template[] = [
  {
    label: 'Message général',
    category: 'GENERAL',
    severity: 'INFO',
    audience: 'ALL',
    title: 'Message du Haut Conseil',
    message: '',
    instructions: '',
    recommendations: [],
  },
  {
    label: 'Inondation',
    category: 'FLOOD',
    severity: 'CRITICAL',
    audience: 'DISTRICTS',
    title: 'Montée des eaux',
    message: 'Une montée inhabituelle du niveau de l’eau est observée.',
    instructions: 'Évitez les berges et les sous-sols.\nMontez dans les étages.\nSuivez les consignes des secours.',
    recommendations: [],
  },
  {
    label: 'Canicule',
    category: 'HEATWAVE',
    severity: 'WARNING',
    audience: 'VULNERABLE',
    title: 'Vague de chaleur',
    message: 'Une vague de chaleur touche la ville.',
    instructions: 'Restez au frais.\nHydratez-vous régulièrement.\nPrenez des nouvelles de vos proches isolés.',
    recommendations: [
      { title: 'Personnes âgées', text: 'Buvez de l’eau toutes les heures, même sans soif.' },
      { title: 'Enfants', text: 'Évitez les sorties entre 12h et 16h.' },
    ],
  },
]

const isLive = (a: CityAlert, now: number) => a.is_active && Date.parse(a.starts_at) <= now && (!a.ends_at || Date.parse(a.ends_at) > now)
const isScheduled = (a: CityAlert, now: number) => a.is_active && Date.parse(a.starts_at) > now
const zoneOf = (a: Pick<CityAlert, 'audience' | 'districts'>) =>
  `${AUDIENCE_LABEL[a.audience]}${a.audience !== 'ALL' && a.districts.length ? ` · ${a.districts.map((d) => d.name).join(', ')}` : ''}`
const people = (n: number) => `${n.toLocaleString('fr-FR')} personne${n > 1 ? 's' : ''}`

/** D18 / F29 / F31: compose, schedule and broadcast an alert to exactly the people concerned. */
export default function AlertsPage() {
  const now = useNow()
  const alerts = useAlerts()
  const [closing, setClosing] = useState<CityAlert | null>(null)
  const [history, setHistory] = useState<CityAlert | null>(null)

  const all = alerts.data ?? []
  const live = all.filter((a) => isLive(a, now))
  const scheduled = all.filter((a) => isScheduled(a, now)).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  const past = all.filter((a) => !isLive(a, now) && !isScheduled(a, now))

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Alertes & communications"
        codes={['D18', 'F29', 'F31']}
        lead="Diffusez un message à toute la ville, à des quartiers ou aux personnes vulnérables : il s’affiche en plein écran chez les habitants concernés, au moment choisi, avec ce qu’ils doivent faire."
      />

      {alerts.isError && <EmptyState title={messageFor(alerts.error)} icon="alert" />}

      {live.length > 0 && (
        <div className={[layout.grid, layout.cols2].join(' ')}>
          {live.map((a) => (
            <Panel
              key={a.id}
              kicker={`${a.category} · en cours depuis ${formatRelative(a.starts_at, now).replace('il y a ', '')}`}
              title={a.title}
              accent={a.severity === 'CRITICAL' ? 'alert' : a.severity === 'WARNING' ? 'ember' : 'ice'}
              actions={
                <>
                  <Button size="sm" variant="subtle" icon="scroll" onClick={() => setHistory(a)}>
                    Historique
                  </Button>
                  <Button size="sm" icon="check" onClick={() => setClosing(a)}>
                    Clôturer
                  </Button>
                </>
              }
            >
              <div className={layout.row}>
                <Tag tone={SEVERITY_TONE[a.severity]} pulse={a.severity === 'CRITICAL'}>
                  {SEVERITY_LABEL[a.severity]}
                </Tag>
                <Tag tone="neutral">{zoneOf(a)}</Tag>
              </div>
              <p>{stepsOf(a.instructions)[0] ?? a.message}</p>
              <p className={[layout.muted, layout.small].join(' ')}>
                {a.notify ? `${people(a.recipients)} notifiée${a.recipients > 1 ? 's' : ''}` : 'Bandeau seul, sans notification'}
                {' · '}
                {a.ends_at ? `jusqu’au ${formatDateTime(a.ends_at)}` : 'jusqu’à clôture'}
                {a.source && ` · ${a.source}`}
              </p>
            </Panel>
          ))}
        </div>
      )}

      {scheduled.length > 0 && (
        <Panel kicker="Programmées" title="Diffusions à venir" accent="ice">
          <ul className={styles.sectionList}>
            {scheduled.map((a) => (
              <li key={a.id} className={styles.alertRow}>
                <Tag tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Tag>
                <span>
                  <strong>{a.title}</strong>
                  <small className={layout.muted}>
                    {zoneOf(a)} · diffusion {formatRelative(a.starts_at, now)} ({formatDateTime(a.starts_at)})
                  </small>
                </span>
                <Button size="sm" variant="subtle" icon="close" onClick={() => setClosing(a)}>
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AlertComposer />

      <Panel kicker="Historique" title="Alertes terminées">
        {alerts.isPending ? (
          <Skeleton lines={4} />
        ) : past.length === 0 ? (
          <EmptyState title="Aucune alerte terminée" icon="siren" />
        ) : (
          <ul className={styles.sectionList}>
            {past.map((a) => (
              <li key={a.id} className={styles.alertRow}>
                <Tag tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Tag>
                <span>
                  <strong>{a.title}</strong>
                  <small className={layout.muted}>
                    {zoneOf(a)} · {formatDateTime(a.starts_at)}
                    {a.ends_at && ` → ${formatDateTime(a.ends_at)}`}
                  </small>
                </span>
                <small className={layout.muted}>{a.notify ? `${people(a.recipients)} notifiée${a.recipients > 1 ? 's' : ''}` : 'Sans notification'}</small>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {closing && <CloseAlertModal alert={closing} scheduled={isScheduled(closing, now)} onClose={() => setClosing(null)} />}
      {history && (
        <Modal open onClose={() => setHistory(null)} kicker="F47" title={history.title}>
          <EntityHistory entity="Alert" entityId={history.id} />
        </Modal>
      )}
    </motion.div>
  )
}

function CloseAlertModal({ alert, scheduled, onClose }: { alert: CityAlert; scheduled: boolean; onClose: () => void }) {
  const close = useCloseAlert()
  const confirm = () =>
    close.mutate(alert.id, {
      onSuccess: () => {
        toast(scheduled ? `Diffusion « ${alert.title} » annulée` : `Alerte « ${alert.title} » clôturée : le bandeau disparaît chez les habitants`, 'info')
        onClose()
      },
      onError: (error) => toast(messageFor(error), 'alert'),
    })
  return (
    <Modal
      open
      onClose={onClose}
      kicker="D18"
      title={scheduled ? 'Annuler cette diffusion ?' : 'Clôturer cette alerte ?'}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Retour
          </Button>
          <Button variant="primary" icon="check" onClick={confirm} disabled={close.isPending} aria-busy={close.isPending}>
            {scheduled ? 'Annuler la diffusion' : 'Clôturer'}
          </Button>
        </>
      }
    >
      <p>
        « {alert.title} »{' '}
        {scheduled
          ? 'ne sera pas diffusée et personne ne sera notifié.'
          : 'disparaît du bandeau et de l’écran des habitants dans la minute. Elle reste dans l’historique.'}
      </p>
    </Modal>
  )
}

/* ─── composer ──────────────────────────────────────────────────────────── */

function AlertComposer() {
  const now = useNow()
  const create = useCreateAlert()
  const districts = useDistricts()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [instructions, setInstructions] = useState('')
  const [category, setCategory] = useState('GENERAL')
  const [severity, setSeverity] = useState<AlertSeverity>('WARNING')
  const [audience, setAudience] = useState<AlertAudience>('ALL')
  const [districtIds, setDistrictIds] = useState<number[]>([])
  const [recommendations, setRecommendations] = useState<AlertRecommendation[]>([])
  const [recoTitle, setRecoTitle] = useState('')
  const [recoText, setRecoText] = useState('')
  const [when, setWhen] = useState<When>('now')
  const [startsAt, setStartsAt] = useState('')
  const [duration, setDuration] = useState<Duration>('none')
  const [endsAt, setEndsAt] = useState('')
  const [source, setSource] = useState('Haut Conseil de la Ville')
  const [notify, setNotify] = useState(true)
  const [angle, setAngle] = useState<'concerned' | 'other'>('concerned')

  const targets = audience === 'ALL' ? [] : districtIds
  const reach = useAlertAudience(audience, targets)
  const districtList = districts.data ?? []
  const zone = zoneOf({ audience, districts: districtList.filter((d) => districtIds.includes(d.id)) })

  const reset = () => {
    setTitle('')
    setMessage('')
    setInstructions('')
    setRecommendations([])
    setDistrictIds([])
    setWhen('now')
    setStartsAt('')
    setDuration('none')
    setEndsAt('')
  }

  const applyTemplate = (t: Template) => {
    setCategory(t.category)
    setSeverity(t.severity)
    setAudience(t.audience)
    setTitle(t.title)
    setMessage(t.message)
    setInstructions(t.instructions)
    setRecommendations(t.recommendations)
  }

  /** start and end as the server expects them; computed when sending, so "now" is the moment of the click */
  const period = () => {
    const start = when === 'later' ? fromLocalInput(startsAt) : null
    const base = start ? Date.parse(start) : Date.now()
    const end = duration === 'none' ? null : duration === 'custom' ? fromLocalInput(endsAt) : new Date(base + Number(duration) * 3_600_000).toISOString()
    return { starts_at: start ?? undefined, ends_at: end }
  }

  const form = useApiForm({
    labels: { title: 'Titre', message: 'Message', instructions: 'Consignes', district_ids: 'Quartiers', starts_at: 'Début', ends_at: 'Fin', source: 'Source' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!title.trim()) errors.title = 'Donnez un titre court : c’est ce que les habitants lisent en premier.'
      if (!message.trim()) errors.message = 'Dites ce qui se passe.'
      if (audience === 'DISTRICTS' && districtIds.length === 0) errors.district_ids = 'Choisissez au moins un quartier.'
      if (when === 'later' && (!startsAt || Date.parse(startsAt) <= Date.now())) errors.starts_at = 'Choisissez un moment à venir.'
      if (duration === 'custom') {
        const { starts_at, ends_at } = period()
        if (!ends_at || Date.parse(ends_at) <= (starts_at ? Date.parse(starts_at) : Date.now())) errors.ends_at = 'La fin doit être après le début.'
      }
      return errors
    },
    submit: () =>
      create.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        category: category.trim() || 'GENERAL',
        severity,
        audience,
        district_ids: targets,
        instructions: instructions.trim() || null,
        recommendations: recommendations.length ? recommendations : null,
        source: source.trim() || null,
        notify,
        ...period(),
      }),
    onSuccess: (alert) => {
      toast(
        alert.scheduled
          ? `Alerte programmée pour ${formatDateTime(alert.starts_at)}${notify ? ' : les personnes concernées seront notifiées à l’heure dite' : ''}`
          : notify
            ? `Alerte diffusée · ${people(alert.notified)} notifiée${alert.notified > 1 ? 's' : ''}`
            : 'Alerte diffusée : elle s’affiche chez les habitants concernés',
        alert.severity === 'CRITICAL' ? 'alert' : 'ok',
      )
      reset()
    },
  })

  const addRecommendation = () => {
    if (!recoText.trim()) return
    setRecommendations((list) => [...list, { ...(recoTitle.trim() ? { title: recoTitle.trim() } : {}), text: recoText.trim() }])
    setRecoTitle('')
    setRecoText('')
  }

  const toggleDistrict = (id: number) => setDistrictIds((ids) => (ids.includes(id) ? ids.filter((d) => d !== id) : [...ids, id]))
  const steps = stepsOf(instructions)
  const recos = recommendationsOf({ recommendations })

  return (
    <form
      className={[layout.grid, layout.split].join(' ')}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit(undefined)
      }}
    >
      <Panel kicker="Composer" title="Nouvelle alerte" accent="alert">
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <div className={layout.row}>
          <span className={layout.sectionLabel}>Modèles</span>
          {TEMPLATES.map((t) => (
            <Button key={t.label} size="sm" variant="subtle" onClick={() => applyTemplate(t)}>
              {t.label}
            </Button>
          ))}
        </div>
        <div className={layout.formGrid}>
          <Field id={form.fieldId('title')} label="Titre" required error={form.errors.title}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} aria-invalid={invalid} maxLength={191} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Catégorie" hint="GENERAL, FLOOD, HEATWAVE…">
            {(id, d) => <TextInput id={id} aria-describedby={d} value={category} onChange={(e) => setCategory(e.target.value.toUpperCase())} />}
          </Field>
        </div>
        <Field id={form.fieldId('message')} label="Ce qui se passe" required error={form.errors.message}>
          {(id, d, invalid) => <TextArea id={id} aria-describedby={d} aria-invalid={invalid} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('instructions')} label="Ce que les habitants doivent faire" hint="Une action par ligne : chacune devient une étape numérotée à l’écran." error={form.errors.instructions}>
          {(id, d, invalid) => <TextArea id={id} aria-describedby={d} aria-invalid={invalid} value={instructions} onChange={(e) => setInstructions(e.target.value)} />}
        </Field>

        <p className={layout.sectionLabel}>Gravité</p>
        <FilterChips<AlertSeverity>
          label="Gravité"
          value={severity}
          onChange={setSeverity}
          options={(['INFO', 'WARNING', 'CRITICAL'] as const).map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))}
        />

        <p className={layout.sectionLabel}>Public</p>
        <FilterChips<AlertAudience>
          label="Public"
          value={audience}
          onChange={setAudience}
          options={(['ALL', 'DISTRICTS', 'VULNERABLE'] as const).map((a) => ({ value: a, label: AUDIENCE_LABEL[a] }))}
        />
        {audience !== 'ALL' && (
          <div id={form.fieldId('district_ids')} tabIndex={-1}>
            <DistrictMap
              districts={districtList}
              label={audience === 'DISTRICTS' ? 'Choisir les quartiers concernés' : 'Limiter à certains quartiers (facultatif)'}
              selected={districtIds}
              onToggle={toggleDistrict}
            />
            {form.errors.district_ids && (
              <p className={styles.fieldError}>
                <Icon name="alert" size={13} /> {form.errors.district_ids}
              </p>
            )}
          </div>
        )}

        <p className={layout.sectionLabel}>Recommandations par public (F31)</p>
        {recommendations.length > 0 && (
          <ul className={styles.recoList}>
            {recommendations.map((r, i) => (
              <li key={`${r.title}-${r.text}`}>
                <span>
                  {r.title && <strong>{r.title} : </strong>}
                  {r.text}
                </span>
                <Button size="sm" variant="subtle" icon="close" iconOnly aria-label={`Retirer la recommandation ${i + 1}`} onClick={() => setRecommendations((list) => list.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ul>
        )}
        <div className={styles.recoAdd}>
          <TextInput aria-label="Public de la recommandation" placeholder="Public (ex. Personnes âgées)" value={recoTitle} onChange={(e) => setRecoTitle(e.target.value)} />
          <TextInput
            aria-label="Recommandation"
            placeholder="Buvez de l’eau toutes les heures."
            value={recoText}
            onChange={(e) => setRecoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addRecommendation()
              }
            }}
          />
          <Button size="sm" icon="plus" disabled={!recoText.trim()} onClick={addRecommendation}>
            Ajouter
          </Button>
        </div>

        <p className={layout.sectionLabel}>Au bon moment</p>
        <FilterChips<When>
          label="Diffusion"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'now', label: 'Maintenant' },
            { value: 'later', label: 'Programmer' },
          ]}
        />
        {when === 'later' && (
          <Field id={form.fieldId('starts_at')} label="Début de la diffusion" required error={form.errors.starts_at}>
            {(id, d, invalid) => (
              <TextInput id={id} type="datetime-local" aria-describedby={d} aria-invalid={invalid} min={toLocalInput(new Date(now).toISOString())} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            )}
          </Field>
        )}
        <FilterChips<Duration> label="Durée" value={duration} onChange={setDuration} options={DURATIONS} />
        {duration === 'custom' && (
          <Field id={form.fieldId('ends_at')} label="Fin de l’alerte" required error={form.errors.ends_at}>
            {(id, d, invalid) => <TextInput id={id} type="datetime-local" aria-describedby={d} aria-invalid={invalid} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}
          </Field>
        )}
        <div className={layout.formGrid}>
          <Field id={form.fieldId('source')} label="Source" error={form.errors.source}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} aria-invalid={invalid} value={source} onChange={(e) => setSource(e.target.value)} />}
          </Field>
          <Toggle checked={notify} onChange={setNotify} label="Notifier les personnes concernées" />
        </div>
      </Panel>

      <div className={layout.stack}>
        <Panel kicker="Portée" title={notify ? 'Personnes notifiées' : 'Personnes concernées'}>
          <p className={styles.reach} aria-live="polite">
            {reach.data === undefined ? '…' : <AnimatedNumber value={reach.data} />}
          </p>
          <p className={[layout.muted, layout.small].join(' ')}>
            {zone}
            {audience !== 'ALL' && districtIds.length === 0 && ' · toute la ville'}
            {!notify && ' · bandeau seul, sans notification'}
          </p>
        </Panel>

        <Panel kicker="Aperçu" title="Ce que voient les habitants">
          {audience !== 'ALL' && (
            <FilterChips<'concerned' | 'other'>
              label="Point de vue"
              value={angle}
              onChange={setAngle}
              options={[
                { value: 'concerned', label: 'Habitant concerné' },
                { value: 'other', label: 'Habitant non concerné' },
              ]}
            />
          )}
          {audience === 'ALL' || angle === 'concerned' ? (
            <div className={styles.transmission} data-severity={severity} role="img" aria-label="Aperçu de l’écran de transmission">
              <p className={styles.transmissionStrip}>
                <Icon name="megaphone" size={13} /> Transmission prioritaire · {source || 'Haut Conseil de la Ville'}
              </p>
              <div className={styles.transmissionBody}>
                <p className={styles.transmissionTags}>
                  <span>
                    <Icon name={SEVERITY_ICON[severity]} size={13} /> {CITIZEN_LEVEL[severity]}
                  </span>
                  <span>
                    <Icon name="pin" size={13} /> {audience === 'ALL' ? 'Toute la ville' : zone}
                  </span>
                </p>
                <strong>{title || 'Titre de l’alerte'}</strong>
                <p>{message || 'Ce qui se passe.'}</p>
                {steps.length > 0 && (
                  <ol className={styles.transmissionSteps}>
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                {recos.length > 0 && (
                  <ul className={styles.reco}>
                    {recos.map((r) => (
                      <li key={`${r.title}-${r.text}`}>
                        {r.title && <b>{r.title} : </b>}
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.preview}>
              <p>
                <b>Pas d’écran plein ni de notification.</b> L’alerte figure dans la section Haut Conseil, marquée « Ne concerne pas votre quartier ».
              </p>
            </div>
          )}
          <p className={[layout.muted, layout.small].join(' ')}>
            {audience === 'ALL'
              ? 'Tous les habitants la voient en plein écran, sur le sas compris ; elle reste ensuite dans le bandeau.'
              : 'Les personnes concernées la voient en plein écran, puis dans le bandeau jusqu’à la fin.'}
          </p>
          <Button
            type="submit"
            variant={severity === 'CRITICAL' ? 'danger' : 'primary'}
            icon={when === 'later' ? 'calendar' : 'siren'}
            disabled={form.pending}
            aria-busy={form.pending}
          >
            {when === 'later' ? 'Programmer la diffusion' : 'Diffuser maintenant'}
          </Button>
        </Panel>
      </div>
    </form>
  )
}
