import { useState } from 'react'
import { motion } from 'motion/react'
import { passkeysSupported } from '../../api/auth'
import { messageFor, toApiError } from '../../api/errors'
import {
  useAddPasskey,
  useChangePassword,
  useDeletePasskey,
  useDisableMyTwoFactor,
  useEnableMyTwoFactor,
  useForgetDevice,
  useMySecurity,
  useRevokeMySessions,
  useSetupMyTwoFactor,
  useUpdateMe,
} from '../../api/me'
import { useSessionUser } from '../../api/session'
import type { TwoFactorSetup } from '../../api/types'
import { useApiForm } from '../../hooks/useApiForm'
import { formatDateTime, formatRelative } from '../lib/format'
import { ROLE_LABEL } from '../lib/labels'
import { useNow } from '../lib/useNow'
import { toast } from '../stores/toastStore'
import { Tag } from '../ui/Badges'
import { Button } from '../ui/Button'
import { ErrorSummary } from '../ui/ErrorSummary'
import { Field, TextInput } from '../ui/Controls'
import { EmptyState, Skeleton } from '../ui/Feedback'
import { Modal } from '../ui/Overlay'
import { PageHeader } from '../ui/PageHeader'
import { Panel } from '../ui/Panel'
import { stagger } from '../ui/motion'
import layout from '../ui/layout.module.css'

/** BO-05: « Mon compte », the same page in both spaces: profile, password, second factor, passkeys, devices. */
export default function AccountPage() {
  const user = useSessionUser()
  const security = useMySecurity()
  if (!user) return null
  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader title="Mon compte" codes={['F53', 'F54', 'D02']} lead={`${user.email} · ${ROLE_LABEL[user.role]}. Votre profil et la sécurité de vos connexions.`} />
      <div className={[layout.grid, layout.cols2].join(' ')}>
        <ProfilePanel />
        <PasswordPanel />
      </div>
      {security.isError ? (
        <EmptyState title={messageFor(security.error)} icon="alert" />
      ) : !security.data ? (
        <Skeleton lines={8} />
      ) : (
        <>
          <TwoFactorPanel enabledAt={security.data.two_factor.enabled_at} required={security.data.two_factor.required} recoveryLeft={security.data.two_factor.recovery_codes_left} />
          <div className={[layout.grid, layout.cols2].join(' ')}>
            <PasskeysPanel passkeys={security.data.passkeys} />
            <DevicesPanel devices={security.data.devices} />
          </div>
        </>
      )}
    </motion.div>
  )
}

function ProfilePanel() {
  const user = useSessionUser()!
  const update = useUpdateMe()
  const [draft, setDraft] = useState({ name: user.name, last_name: user.last_name, phone: user.phone ?? '' })
  const form = useApiForm({
    labels: { name: 'Prénom', last_name: 'Nom', phone: 'Téléphone' },
    submit: () => update.mutateAsync({ name: draft.name.trim(), last_name: draft.last_name.trim(), phone: draft.phone.trim() || null }),
    onSuccess: () => toast('Profil enregistré'),
  })
  return (
    <Panel kicker="Profil" title="Mes informations">
      <form
        noValidate
        className={layout.stack}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <div className={layout.formGrid}>
          <Field id={form.fieldId('name')} label="Prénom" error={form.errors.name}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} aria-invalid={invalid} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
          </Field>
          <Field id={form.fieldId('last_name')} label="Nom" error={form.errors.last_name}>
            {(id, d, invalid) => <TextInput id={id} aria-describedby={d} aria-invalid={invalid} value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />}
          </Field>
          <div className={layout.full}>
            <Field id={form.fieldId('phone')} label="Téléphone" error={form.errors.phone}>
              {(id, d, invalid) => <TextInput id={id} aria-describedby={d} aria-invalid={invalid} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />}
            </Field>
          </div>
        </div>
        <Button type="submit" variant="primary" icon="check" disabled={form.pending}>
          Enregistrer
        </Button>
      </form>
    </Panel>
  )
}

function PasswordPanel() {
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const form = useApiForm({
    labels: { current_password: 'Mot de passe actuel', new_password: 'Nouveau mot de passe', confirm: 'Confirmation' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!current) errors.current_password = 'Saisissez votre mot de passe actuel.'
      if (next.length < 8) errors.new_password = 'Au moins 8 caractères.'
      else if (next !== confirm) errors.confirm = 'Les deux mots de passe ne correspondent pas.'
      return errors
    },
    // the server says « Current password is incorrect » (400)
    describeError: (error) => (/incorrect/i.test(toApiError(error).message) ? 'Le mot de passe actuel est incorrect.' : null),
    submit: () => change.mutateAsync({ current_password: current, new_password: next }),
    onSuccess: () => {
      toast('Mot de passe changé')
      setCurrent('')
      setNext('')
      setConfirm('')
    },
  })
  return (
    <Panel kicker="Connexion" title="Mot de passe">
      <form
        noValidate
        className={layout.stack}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field id={form.fieldId('current_password')} label="Mot de passe actuel" error={form.errors.current_password}>
          {(id, d, invalid) => <TextInput id={id} type="password" autoComplete="current-password" aria-describedby={d} aria-invalid={invalid} value={current} onChange={(e) => setCurrent(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('new_password')} label="Nouveau mot de passe" hint="8 caractères au moins." error={form.errors.new_password}>
          {(id, d, invalid) => <TextInput id={id} type="password" autoComplete="new-password" aria-describedby={d} aria-invalid={invalid} value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('confirm')} label="Confirmation" error={form.errors.confirm}>
          {(id, d, invalid) => <TextInput id={id} type="password" autoComplete="new-password" aria-describedby={d} aria-invalid={invalid} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" icon="key" disabled={form.pending}>
          Changer le mot de passe
        </Button>
      </form>
    </Panel>
  )
}

function TwoFactorPanel({ enabledAt, required, recoveryLeft }: { enabledAt: string | null; required: boolean; recoveryLeft: number }) {
  const setup = useSetupMyTwoFactor()
  const enable = useEnableMyTwoFactor()
  const disable = useDisableMyTwoFactor()
  const [payload, setPayload] = useState<TwoFactorSetup | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [password, setPassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

  const enableForm = useApiForm({
    labels: { code: 'Code de vérification' },
    validate: (): Record<string, string> => (/^\d{6}$/.test(code.replace(/\s/g, '')) ? {} : { code: 'Saisissez les 6 chiffres affichés par votre application.' }),
    submit: () => enable.mutateAsync(code.replace(/\s/g, '')),
    onSuccess: (result) => {
      setCodes(result.recovery_codes)
      setPayload(null)
      setCode('')
      toast('Double vérification activée')
    },
  })

  return (
    <Panel kicker="F53" title="Double vérification" accent={enabledAt ? 'ok' : required ? 'alert' : undefined}>
      {codes ? (
        <div className={layout.stack}>
          <p role="status">Notez ces codes de secours : chacun permet une connexion si vous perdez votre téléphone. Ils ne seront plus affichés.</p>
          <ul className={layout.row} style={{ listStyle: 'none', padding: 0 }}>
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <div className={layout.row}>
            <Button icon="file" onClick={() => navigator.clipboard.writeText(codes.join('\n')).then(() => toast('Codes copiés', 'info'), () => toast('Copie impossible', 'alert'))}>
              Copier
            </Button>
            <Button variant="primary" onClick={() => setCodes(null)}>
              J’ai noté mes codes
            </Button>
          </div>
        </div>
      ) : enabledAt ? (
        <div className={layout.stack}>
          <p>
            <Tag tone="ok">Activée</Tag> depuis le {formatDateTime(enabledAt)} · {recoveryLeft} code{recoveryLeft > 1 ? 's' : ''} de secours restant{recoveryLeft > 1 ? 's' : ''}.
          </p>
          {required ? (
            <p className={layout.muted}>La politique de sécurité l’impose à votre rôle : elle ne peut pas être désactivée.</p>
          ) : (
            <Button variant="danger" onClick={() => setDisabling(true)}>
              Désactiver
            </Button>
          )}
        </div>
      ) : payload ? (
        <form
          noValidate
          className={layout.stack}
          onSubmit={(e) => {
            e.preventDefault()
            void enableForm.handleSubmit(undefined)
          }}
        >
          <p>Scannez ce QR code avec une application d’authentification, puis saisissez le code qu’elle affiche.</p>
          <img src={payload.qr_data_url} alt="QR code à scanner avec votre application d’authentification" width={200} height={200} style={{ background: '#fff', padding: 8, alignSelf: 'flex-start' }} />
          <p className={layout.small}>
            Saisie manuelle : <code>{payload.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </p>
          <ErrorSummary id={enableForm.summaryId} errors={enableForm.summary} formError={enableForm.formError} />
          <Field id={enableForm.fieldId('code')} label="Code à 6 chiffres" error={enableForm.errors.code}>
            {(id, d, invalid) => <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={7} aria-describedby={d} aria-invalid={invalid} value={code} onChange={(e) => setCode(e.target.value)} />}
          </Field>
          <div className={layout.row}>
            <Button type="submit" variant="primary" icon="check" disabled={enableForm.pending}>
              Activer
            </Button>
            <Button variant="subtle" onClick={() => setPayload(null)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className={layout.stack}>
          <p>{required ? 'La politique de sécurité l’impose à votre rôle : activez-la maintenant.' : 'Un code à 6 chiffres, donné par une application sur votre téléphone, sera demandé à chaque connexion par mot de passe.'}</p>
          <Button
            variant="primary"
            icon="shield"
            disabled={setup.isPending}
            onClick={() => setup.mutate(undefined, { onSuccess: setPayload, onError: (error) => toast(messageFor(error), 'alert') })}
          >
            Activer la double vérification
          </Button>
        </div>
      )}

      <Modal
        open={disabling}
        onClose={() => setDisabling(false)}
        kicker="F53"
        title="Désactiver la double vérification ?"
        footer={
          <>
            <Button variant="subtle" onClick={() => setDisabling(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={disable.isPending || !password || !disableCode}
              onClick={() =>
                disable.mutate(
                  { password, code: disableCode.replace(/\s/g, '') },
                  {
                    onSuccess: () => {
                      toast('Double vérification désactivée', 'alert')
                      setDisabling(false)
                      setPassword('')
                      setDisableCode('')
                    },
                    onError: (error) => toast(messageFor(error), 'alert'),
                  },
                )
              }
            >
              Désactiver
            </Button>
          </>
        }
      >
        <Field label="Mot de passe">{(id) => <TextInput id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Field label="Code de l’application">{(id) => <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />}</Field>
      </Modal>
    </Panel>
  )
}

function PasskeysPanel({ passkeys }: { passkeys: { id: number; label: string; created_at: string; last_used_at: string | null }[] }) {
  const now = useNow()
  const add = useAddPasskey()
  const remove = useDeletePasskey()
  const [label, setLabel] = useState('')
  const supported = passkeysSupported()
  return (
    <Panel kicker="D02" title="Clés d’accès">
      <p className={layout.small}>Une clé d’accès remplace le mot de passe : la connexion se valide avec l’empreinte ou le code de cet appareil. Elle vaut double vérification.</p>
      {passkeys.length === 0 ? (
        <p className={layout.muted}>Aucune clé d’accès.</p>
      ) : (
        <ul className={layout.stack} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {passkeys.map((p) => (
            <li key={p.id} className={layout.row} style={{ justifyContent: 'space-between' }}>
              <span>
                <strong>{p.label}</strong>
                <span className={[layout.muted, layout.small].join(' ')} style={{ display: 'block' }}>
                  Ajoutée le {formatDateTime(p.created_at)} · {p.last_used_at ? `utilisée ${formatRelative(p.last_used_at, now)}` : 'jamais utilisée'}
                </span>
              </span>
              <Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(p.id, { onSuccess: () => toast('Clé d’accès supprimée'), onError: (error) => toast(messageFor(error), 'alert') })}>
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}
      {supported ? (
        <form
          className={layout.row}
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate(label.trim() || 'Clé d’accès', {
              onSuccess: () => {
                toast('Clé d’accès ajoutée')
                setLabel('')
              },
              onError: (error) => {
                const name = error instanceof Error ? error.name : ''
                toast(name === 'NotAllowedError' || name === 'AbortError' ? 'Ajout annulé' : messageFor(error), 'alert')
              },
            })
          }}
        >
          <TextInput aria-label="Nom de la clé" placeholder="Ex. : MacBook du bureau" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" icon="plus" disabled={add.isPending} aria-busy={add.isPending}>
            Ajouter une clé sur cet appareil
          </Button>
        </form>
      ) : (
        <p className={layout.muted}>Ce navigateur ne gère pas les clés d’accès.</p>
      )}
    </Panel>
  )
}

function DevicesPanel({ devices }: { devices: { id: number; label: string; last_seen: string; first_seen: string; last_ip: string | null; current?: boolean }[] }) {
  const now = useNow()
  const forget = useForgetDevice()
  const revoke = useRevokeMySessions()
  return (
    <Panel kicker="F54" title="Appareils connectés">
      <ul className={layout.stack} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {devices.map((d) => (
          <li key={d.id} className={layout.row} style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{d.label}</strong> {d.current && <Tag tone="ice">cet appareil</Tag>}
              <span className={[layout.muted, layout.small].join(' ')} style={{ display: 'block' }}>
                Vu {formatRelative(d.last_seen, now)} · première fois le {formatDateTime(d.first_seen)}
                {d.last_ip ? ` · IP ${d.last_ip}` : ''}
              </span>
            </span>
            {!d.current && (
              <Button size="sm" variant="subtle" disabled={forget.isPending} onClick={() => forget.mutate(d.id, { onSuccess: () => toast('Appareil oublié'), onError: (error) => toast(messageFor(error), 'alert') })}>
                Oublier
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button
        variant="danger"
        icon="logout"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(undefined, { onSuccess: () => toast('Tous les autres appareils sont déconnectés'), onError: (error) => toast(messageFor(error), 'alert') })}
      >
        Déconnecter tous les autres appareils
      </Button>
      <p className={[layout.muted, layout.small].join(' ')}>
        Une connexion depuis un appareil inconnu vous est signalée dans la cloche. Effacer les données de ce navigateur le fait passer pour un nouvel appareil : c’est normal.
      </p>
    </Panel>
  )
}
