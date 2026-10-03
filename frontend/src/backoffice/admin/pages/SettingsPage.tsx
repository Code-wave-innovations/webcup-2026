import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { LOCALES } from '../../mocks/config'
import { updateSettings, useConfigStore } from '../../stores/configStore'
import { Button } from '../../ui/Button'
import { Field, Select, TextInput, Toggle } from '../../ui/Controls'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

/** D07 / D08: platform settings — home page hierarchy, languages, security, maintenance. */
export default function SettingsPage() {
  const actor = useActor()
  const settings = useConfigStore((s) => s.settings)
  const sections = settings.home_sections

  const move = (index: number, delta: number) => {
    const next = [...sections]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    updateSettings({ home_sections: next }, actor.id, 'Ordre de la page d’accueil')
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Paramètres de la plateforme"
        codes={['D07', 'D08', 'F37']}
        lead="Réglages globaux. Chaque modification est appliquée immédiatement et enregistrée dans le journal d’audit."
      />

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
                  onChange={(enabled) => updateSettings({ home_sections: sections.map((s) => (s.key === section.key ? { ...s, enabled } : s)) }, actor.id, 'Sections de l’accueil')}
                />
              </motion.li>
            ))}
          </ol>
        </Panel>

        <div className={layout.stack}>
          <Panel kicker="D14 · F27" title="Langues">
            <Field label="Langue par défaut">
              {(id) => (
                <Select id={id} value={settings.default_locale} onChange={(e) => updateSettings({ default_locale: e.target.value }, actor.id, 'Langue par défaut')}>
                  {LOCALES.filter((l) => settings.enabled_locales.includes(l.code)).map((l) => (
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
                  checked={settings.enabled_locales.includes(l.code)}
                  disabled={l.code === settings.default_locale}
                  onChange={(on) =>
                    updateSettings(
                      { enabled_locales: on ? [...settings.enabled_locales, l.code] : settings.enabled_locales.filter((c) => c !== l.code) },
                      actor.id,
                      'Langues proposées',
                    )
                  }
                />
              ))}
            </div>
          </Panel>

          <Panel kicker="F37 · Sécurité" title="Protection des connexions">
            <div className={layout.formGrid}>
              <Field label="Échecs avant verrouillage">
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={3}
                    max={20}
                    value={settings.login_max_failures}
                    onChange={(e) => updateSettings({ login_max_failures: Number(e.target.value) }, actor.id, 'Sécurité des connexions')}
                  />
                )}
              </Field>
              <Field label="Durée du verrouillage (min)">
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={1}
                    max={120}
                    value={settings.login_lock_minutes}
                    onChange={(e) => updateSettings({ login_lock_minutes: Number(e.target.value) }, actor.id, 'Sécurité des connexions')}
                  />
                )}
              </Field>
              <Field label="Rappel de RDV par défaut (F40)">
                {(id) => (
                  <Select id={id} value={settings.reminder_default_minutes} onChange={(e) => updateSettings({ reminder_default_minutes: Number(e.target.value) }, actor.id, 'Rappels de rendez-vous')}>
                    <option value={60}>1 heure avant</option>
                    <option value={180}>3 heures avant</option>
                    <option value={1440}>24 heures avant</option>
                    <option value={2880}>48 heures avant</option>
                  </Select>
                )}
              </Field>
            </div>
          </Panel>

          <Panel kicker="D08 · Accès" title="Ouverture de la plateforme" className={settings.maintenance_mode ? styles.danger : undefined} accent={settings.maintenance_mode ? 'alert' : undefined}>
            <Toggle checked={settings.registration_open} onChange={(v) => updateSettings({ registration_open: v }, actor.id, 'Inscriptions')} label="Inscriptions ouvertes aux nouveaux habitants" />
            <Toggle
              checked={settings.maintenance_mode}
              onChange={(v) => updateSettings({ maintenance_mode: v }, actor.id, 'Mode maintenance')}
              label="Mode maintenance (espace citoyen en lecture seule)"
            />
            {settings.maintenance_mode && (
              <p className={layout.small} style={{ color: 'var(--color-alert)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="alert" size={16} /> Les habitants ne peuvent plus envoyer de demandes ni réserver.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </motion.div>
  )
}
