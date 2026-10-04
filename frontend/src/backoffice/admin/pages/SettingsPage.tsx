import { useState } from 'react'
import { motion } from 'motion/react'
import { isApiError, messageFor } from '../../../api/errors'
import { useAdminSettings, useUpdateSettings } from '../../../api/settings'
import type { HomeSection, PlatformSettings, SettingsAdminView } from '../../../api/types'
import { formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { LOCALES } from '../../mocks/config'
import { updateSettings as updateSimulated, useConfigStore } from '../../stores/configStore'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { DemoNote, EmptyState, Skeleton } from '../../ui/Feedback'
import { Field, Select, TextInput, Toggle } from '../../ui/Controls'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const REMINDER_OPTIONS = [
  { value: 60, label: '1 heure avant' },
  { value: 180, label: '3 heures avant' },
  { value: 1440, label: '24 heures avant' },
  { value: 2880, label: '48 heures avant' },
]

/** D07 / D08 / F37: platform settings — home page hierarchy, opening, security, reminders (GET/PATCH /api/settings). */
export default function SettingsPage() {
  const settings = useAdminSettings()

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Paramètres de la plateforme"
        lead="Réglages globaux, appliqués dès l’enregistrement. Chaque réglage indique qui l’a modifié en dernier."
      />
      {settings.isPending ? (
        <Panel title="Chargement des paramètres">
          <Skeleton lines={6} />
        </Panel>
      ) : settings.isError ? (
        <SettingsUnavailable error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <SettingsForm view={settings.data} />
      )}
    </motion.div>
  )
}

function SettingsUnavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error) && (error.status === 401 || error.status === 403)) {
    const signedIn = error.status === 403
    return (
      <Panel kicker="D09 · Accès" title={signedIn ? 'Réservé aux administrateurs' : 'Connexion administrateur requise'} accent="alert">
        <p className={layout.muted}>
          {signedIn
            ? 'Le compte connecté n’a pas accès aux paramètres de la plateforme. Connectez-vous avec un compte administrateur.'
            : 'Les paramètres de la plateforme ne s’affichent qu’aux administrateurs connectés.'}
        </p>
      </Panel>
    )
  }
  return (
    <Panel>
      <EmptyState title="Paramètres indisponibles" icon="alert">
        {messageFor(error)}
      </EmptyState>
      <div>
        <Button onClick={onRetry}>
          Réessayer
        </Button>
      </div>
    </Panel>
  )
}

/** "Modifié par Ada R. il y a 3 min", from the most recent change among `keys`. */
function LastChange({ view, keys, now }: { view: SettingsAdminView; keys: (keyof PlatformSettings)[]; now: number }) {
  const latest = keys
    .map((key) => view.updated[key])
    .filter((change) => change !== undefined)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
  if (!latest) return <p className={[layout.muted, layout.small].join(' ')}>Valeur par défaut, jamais modifiée.</p>
  const who = latest.updated_by ? `${latest.updated_by.name} ${latest.updated_by.last_name.charAt(0)}.` : 'un compte supprimé'
  return (
    <p className={[layout.muted, layout.small].join(' ')}>
      Modifié par {who} {formatRelative(latest.updated_at, now)}
    </p>
  )
}

function SettingsForm({ view }: { view: SettingsAdminView }) {
  const now = useNow()
  const update = useUpdateSettings()
  const simulated = useConfigStore((s) => s.settings)
  const { settings, security } = view
  const sections = settings.home_sections
  const [message, setMessage] = useState(settings.maintenance_message)

  const save = (patch: Partial<PlatformSettings>, label: string) =>
    update.mutate(patch, {
      onSuccess: () => toast(`${label} : paramètre enregistré`),
      onError: (error) => toast(`${label} : ${messageFor(error)}`, 'alert'),
    })

  const saveSections = (next: HomeSection[], label: string) => save({ home_sections: next }, label)

  const move = (index: number, delta: number) => {
    const next = [...sections]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    saveSections(next, 'Ordre de la page d’accueil')
  }

  return (
    <div className={[layout.grid, layout.cols2].join(' ')}>
      <Panel kicker="D07 · Accueil" title="Hiérarchie de la page d’accueil">
        <p className={[layout.muted, layout.small].join(' ')}>L’ordre détermine ce que l’habitant voit en premier en arrivant.</p>
        <ol className={styles.sectionList}>
          {sections.map((section, i) => (
            <motion.li key={section.key} layout className={styles.sectionItem} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
              <span className={styles.sectionIndex}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.moveButtons}>
                <Button size="sm" variant="subtle" iconOnly icon="arrowUp" disabled={i === 0} onClick={() => move(i, -1)}>
                  Monter {section.label}
                </Button>
                <Button size="sm" variant="subtle" iconOnly icon="arrowDown" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                  Descendre {section.label}
                </Button>
              </span>
              <span style={{ opacity: section.enabled ? 1 : 0.5 }}>{section.label}</span>
              <Toggle
                hideLabel
                label={`Afficher « ${section.label} »`}
                checked={section.enabled}
                onChange={(enabled) => saveSections(sections.map((s) => (s.key === section.key ? { ...s, enabled } : s)), 'Sections de l’accueil')}
              />
            </motion.li>
          ))}
        </ol>
        <LastChange view={view} keys={['home_sections']} now={now} />
        <p className={layout.sectionLabel}>Aperçu de l’accueil</p>
        <div className={styles.homePreview} aria-label="Aperçu schématique de la page d’accueil de l’habitant">
          {settings.maintenance_mode && (
            <div className={styles.homeBanner}>
              <Icon name="alert" size={14} /> {settings.maintenance_message}
            </div>
          )}
          {sections.map((section) => (
            <div key={section.key} className={[styles.homeBlock, !section.enabled && styles.homeBlockHidden].filter(Boolean).join(' ')}>
              {section.label}
              {!section.enabled && <small> · masqué</small>}
            </div>
          ))}
        </div>
      </Panel>

      <div className={layout.stack}>
        <Panel kicker="D08 · Accès" title="Ouverture de la plateforme" className={settings.maintenance_mode ? styles.danger : undefined} accent={settings.maintenance_mode ? 'alert' : undefined}>
          <Toggle checked={settings.registration_open} onChange={(v) => save({ registration_open: v }, 'Inscriptions')} label="Inscriptions ouvertes aux nouveaux habitants" />
          <Toggle
            checked={settings.maintenance_mode}
            onChange={(v) => save({ maintenance_mode: v }, 'Mode maintenance')}
            label="Mode maintenance (espace citoyen en lecture seule)"
          />
          {settings.maintenance_mode && (
            <p className={layout.small} style={{ color: 'var(--color-alert)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="alert" size={16} /> Les habitants ne peuvent plus envoyer de demandes ni réserver.
            </p>
          )}
          <Field label="Message affiché pendant la maintenance" hint="Lu par les habitants quand une demande ou une réservation est refusée.">
            {(id, describedBy) => (
              <TextInput id={id} aria-describedby={describedBy} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
            )}
          </Field>
          <div>
            <Button
              size="sm"
              variant="subtle"
              icon="check"
              disabled={!message.trim() || message.trim() === settings.maintenance_message}
              onClick={() => save({ maintenance_message: message.trim() }, 'Message de maintenance')}
            >
              Enregistrer le message
            </Button>
          </div>
          <LastChange view={view} keys={['registration_open', 'maintenance_mode', 'maintenance_message']} now={now} />
        </Panel>

        <Panel kicker="F37 · F53 · F40" title="Sécurité et rappels" id="securite">
          <p className={layout.small}>
            Un compte est bloqué après <strong>{security.max_account_failures} mots de passe erronés</strong> en {security.window_minutes} minutes, pendant{' '}
            {security.lock_minutes} minutes au plus. Une adresse IP est bloquée après {security.max_ip_failures} échecs.
          </p>
          <p className={[layout.muted, layout.small].join(' ')}>Seuils fixés par le serveur.</p>
          <p className={layout.sectionLabel}>Double vérification obligatoire (F53)</p>
          <div className={styles.localeChips}>
            {(['ADMIN', 'AGENT', 'CITIZEN'] as const).map((role) => {
              const required = settings.two_factor_required_roles ?? []
              return (
                <Toggle
                  key={role}
                  label={{ ADMIN: 'Administrateurs', AGENT: 'Agents', CITIZEN: 'Habitants' }[role]}
                  checked={required.includes(role)}
                  onChange={(on) =>
                    save({ two_factor_required_roles: on ? [...required, role] : required.filter((r) => r !== role) }, 'Double vérification obligatoire')
                  }
                />
              )
            })}
          </div>
          <p className={[layout.muted, layout.small].join(' ')}>
            À sa prochaine connexion par mot de passe, un compte concerné sans double vérification devra l’activer avant tout accès. Une clé d’accès la remplace.
          </p>
          <LastChange view={view} keys={['two_factor_required_roles']} now={now} />
          <Field label="Rappel de rendez-vous proposé par défaut (F40)">
            {(id) => (
              <Select
                id={id}
                value={settings.reminder_default_minutes}
                onChange={(e) => save({ reminder_default_minutes: Number(e.target.value) }, 'Rappels de rendez-vous')}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <LastChange view={view} keys={['reminder_default_minutes']} now={now} />
        </Panel>

        <Panel kicker="D14 · F27" title="Langues" actions={<DemoNote>Simulé, multilingue hors périmètre</DemoNote>}>
          <Field label="Langue par défaut">
            {(id) => (
              <Select id={id} value={simulated.default_locale} onChange={(e) => updateSimulated({ default_locale: e.target.value }, 'Langue par défaut')}>
                {LOCALES.filter((l) => simulated.enabled_locales.includes(l.code)).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <p className={layout.sectionLabel}>Langues proposées</p>
          <div className={styles.localeChips}>
            {LOCALES.map((l) => (
              <Toggle
                key={l.code}
                label={l.label}
                checked={simulated.enabled_locales.includes(l.code)}
                disabled={l.code === simulated.default_locale}
                onChange={(on) =>
                  updateSimulated(
                    { enabled_locales: on ? [...simulated.enabled_locales, l.code] : simulated.enabled_locales.filter((c) => c !== l.code) },
                    'Langues proposées',
                  )
                }
              />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
