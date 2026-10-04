import { useState, type ReactNode } from 'react'
import { useDistricts } from '../../api/districts'
import { isApiError, messageFor } from '../../api/errors'
import type { ManagedUser, Role } from '../../api/types'
import {
  useDeleteUser,
  useResetTwoFactor,
  useRevokePasskeys,
  useRevokeSessions,
  useUnlockUser,
  useUpdateUser,
  useUser,
  useUserSecurity,
} from '../../api/users'
import { useApiForm } from '../../hooks/useApiForm'
import { useActor } from '../layout/persona'
import { formatDateTime, formatRelative } from '../lib/format'
import { ROLE_LABEL } from '../lib/labels'
import { useNow } from '../lib/useNow'
import { toast } from '../stores/toastStore'
import { Flag, Tag } from '../ui/Badges'
import { Button } from '../ui/Button'
import { ErrorSummary } from '../ui/ErrorSummary'
import { Field, Select, Tabs, TextArea, TextInput, Toggle } from '../ui/Controls'
import { EmptyState, Skeleton } from '../ui/Feedback'
import { Drawer, Modal } from '../ui/Overlay'
import layout from '../ui/layout.module.css'
import { CitizenCard } from './CitizenCard'
import { EntityHistory } from './EntityHistory'

type Tab = 'profil' | 'securite' | 'historique'

const name = (user: Pick<ManagedUser, 'name' | 'last_name'>) => `${user.name} ${user.last_name}`

/**
 * F34 / D08 / BO-05: one account in a drawer. Agents correct a citizen's profile, unlock and
 * deactivate (with a reason), never the e-mail, password or role; admins also change those,
 * act on the account's sign-in security and delete it. Every change lands in the audit log.
 */
export function AccountDrawer({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const query = useUser(userId)
  const user = query.data
  return (
    <Drawer open={userId !== null} onClose={onClose} kicker={user ? ROLE_LABEL[user.role] : 'Compte'} title={user ? name(user) : 'Compte'}>
      {user ? (
        <AccountTabs key={user.id} user={user} onClose={onClose} />
      ) : query.isError ? (
        <EmptyState title={messageFor(query.error)} icon="alert" />
      ) : (
        <Skeleton lines={6} />
      )}
    </Drawer>
  )
}

function AccountTabs({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const admin = useActor().role === 'ADMIN'
  const [tab, setTab] = useState<Tab>('profil')
  return (
    <div className={layout.stack}>
      <Tabs<Tab>
        label="Sections du compte"
        idPrefix="account"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'profil', label: 'Profil' },
          ...(admin ? [{ value: 'securite' as const, label: 'Sécurité' }] : []),
          { value: 'historique', label: 'Historique' },
        ]}
      />
      <div id="account-panel" role="tabpanel" aria-labelledby={`account-tab-${tab}`} className={layout.stack}>
        {tab === 'profil' && <ProfileTab user={user} onClose={onClose} />}
        {tab === 'securite' && admin && <SecurityTab user={user} />}
        {tab === 'historique' && <EntityHistory entity="User" entityId={user.id} />}
      </div>
    </div>
  )
}

/** A confirmation step for a sensitive action */
function Confirm({ open, title, children, confirm, danger, busy, disabled, onConfirm, onClose }: {
  open: boolean
  title: string
  children: ReactNode
  confirm: string
  danger?: boolean
  busy?: boolean
  disabled?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Confirmation"
      title={title}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy || disabled} aria-busy={busy}>
            {confirm}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

function ProfileTab({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const actor = useActor()
  const admin = actor.role === 'ADMIN'
  const self = actor.id === user.id
  const districts = useDistricts().data ?? []
  const update = useUpdateUser()
  const unlock = useUnlockUser()
  const remove = useDeleteUser()

  const [draft, setDraft] = useState({
    name: user.name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone ?? '',
    address: user.address ?? '',
    district_id: user.district_id,
    is_vulnerable: user.is_vulnerable,
  })
  const [role, setRole] = useState<Role>(user.role)
  const [confirmRole, setConfirmRole] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [typedName, setTypedName] = useState('')

  const form = useApiForm({
    labels: { name: 'Prénom', last_name: 'Nom', email: 'E-mail', phone: 'Téléphone', address: 'Adresse', district_id: 'Quartier' },
    describeError: (error) => (isApiError(error) && error.status === 409 ? 'Cet e-mail est déjà utilisé par un autre compte.' : null),
    submit: () =>
      update.mutateAsync({
        id: user.id,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
        district_id: draft.district_id,
        is_vulnerable: draft.is_vulnerable,
        ...(admin ? { name: draft.name.trim(), last_name: draft.last_name.trim(), email: draft.email.trim() } : {}),
      }),
    onSuccess: () => toast('Profil enregistré'),
  })

  const run = (promise: Promise<unknown>, done: string, after?: () => void) =>
    promise.then(
      () => {
        toast(done)
        after?.()
      },
      (error) => toast(messageFor(error), 'alert'),
    )

  return (
    <>
      <CitizenCard citizen={user} />
      <div className={layout.row}>
        <Tag tone={user.is_active ? 'ok' : 'alert'}>{user.is_active ? 'Actif' : 'Désactivé'}</Tag>
        {user.login_locked && (
          <Flag icon="lock" tone="alert">
            Connexion verrouillée{user.locked_until ? ` jusqu’à ${formatDateTime(user.locked_until)}` : ''}
          </Flag>
        )}
      </div>

      <form
        className={layout.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <div className={layout.formGrid}>
          {admin ? (
            <>
              <Field id={form.fieldId('name')} label="Prénom" error={form.errors.name}>
                {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
              </Field>
              <Field id={form.fieldId('last_name')} label="Nom" error={form.errors.last_name}>
                {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />}
              </Field>
              <div className={layout.full}>
                <Field id={form.fieldId('email')} label="E-mail" error={form.errors.email}>
                  {(id, describedBy, invalid) => <TextInput id={id} type="email" aria-describedby={describedBy} aria-invalid={invalid} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />}
                </Field>
              </div>
            </>
          ) : (
            <div className={layout.full}>
              <dl className={layout.dl}>
                <dt>E-mail</dt>
                <dd>{user.email}</dd>
                <dt>Rôle</dt>
                <dd>{ROLE_LABEL[user.role]}</dd>
              </dl>
              <p className={[layout.muted, layout.small].join(' ')}>Modifiables uniquement par un administrateur. Le mot de passe n’est jamais accessible.</p>
            </div>
          )}
          <Field id={form.fieldId('phone')} label="Téléphone" error={form.errors.phone}>
            {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />}
          </Field>
          <Field id={form.fieldId('district_id')} label="Quartier" error={form.errors.district_id}>
            {(id) => (
              <Select id={id} value={draft.district_id ?? ''} onChange={(e) => setDraft({ ...draft, district_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">—</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className={layout.full}>
            <Field id={form.fieldId('address')} label="Adresse" error={form.errors.address}>
              {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />}
            </Field>
          </div>
        </div>
        <Toggle
          checked={draft.is_vulnerable}
          onChange={(value) => setDraft({ ...draft, is_vulnerable: value })}
          label="Personne vulnérable : reçoit les alertes destinées aux personnes vulnérables (F31)"
        />
        <Button type="submit" variant="primary" icon="check" disabled={form.pending} aria-busy={form.pending}>
          Enregistrer le profil
        </Button>
      </form>

      <hr className={layout.divider} />
      <p className={layout.sectionLabel}>Accès au compte</p>
      <div className={layout.row}>
        {user.login_locked && (
          <Button icon="unlock" disabled={unlock.isPending} onClick={() => void run(unlock.mutateAsync(user.id), `Connexion de ${name(user)} débloquée`)}>
            Débloquer la connexion
          </Button>
        )}
        {user.is_active ? (
          <Button variant="danger" icon="lock" disabled={self} onClick={() => setDeactivating(true)}>
            Désactiver le compte
          </Button>
        ) : (
          <Button icon="unlock" disabled={update.isPending} onClick={() => void run(update.mutateAsync({ id: user.id, is_active: true }), `Compte de ${name(user)} réactivé`)}>
            Réactiver le compte
          </Button>
        )}
        {admin && !self && (
          <Button variant="danger" icon="close" onClick={() => setDeleting(true)}>
            Supprimer
          </Button>
        )}
      </div>

      {admin && user.role !== 'CITIZEN' && (
        <>
          <p className={layout.sectionLabel}>Rôle (D08)</p>
          <div className={layout.row}>
            <Select aria-label="Rôle" value={role} disabled={self} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Administrateur</option>
            </Select>
            <Button disabled={role === user.role || self} onClick={() => setConfirmRole(true)}>
              Changer le rôle
            </Button>
          </div>
          {self && <p className={[layout.muted, layout.small].join(' ')}>Vous ne pouvez pas changer votre propre rôle.</p>}
        </>
      )}

      <Confirm
        open={confirmRole}
        title={`Passer ${name(user)} en ${ROLE_LABEL[role].toLowerCase()} ?`}
        confirm="Changer le rôle"
        danger={role === 'ADMIN'}
        busy={update.isPending}
        onClose={() => setConfirmRole(false)}
        onConfirm={() => void run(update.mutateAsync({ id: user.id, role }), `${name(user)} est maintenant ${ROLE_LABEL[role].toLowerCase()}`, () => setConfirmRole(false))}
      >
        <p>{role === 'ADMIN' ? 'Un administrateur accède à tous les comptes, au journal d’audit et aux paramètres. Action sensible, tracée.' : 'Le compte perd l’accès à l’administration dès sa prochaine requête.'}</p>
      </Confirm>

      <Confirm
        open={deactivating}
        title={`Désactiver le compte de ${name(user)} ?`}
        confirm="Désactiver"
        danger
        busy={update.isPending}
        disabled={reason.trim().length < 3}
        onClose={() => setDeactivating(false)}
        onConfirm={() =>
          void run(update.mutateAsync({ id: user.id, is_active: false, reason: reason.trim() }), `Compte de ${name(user)} désactivé`, () => {
            setDeactivating(false)
            setReason('')
          })
        }
      >
        <Field label="Motif" required hint="Obligatoire : il est conservé dans le journal d’audit (F34).">
          {(id, describedBy) => <TextArea id={id} aria-describedby={describedBy} aria-required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : demande de l’habitant, usurpation signalée…" />}
        </Field>
        <p className={[layout.muted, layout.small].join(' ')}>La personne perd l’accès immédiatement ; ses demandes restent consultables.</p>
      </Confirm>

      <Confirm
        open={deleting}
        title={`Supprimer définitivement ${name(user)} ?`}
        confirm="Supprimer le compte"
        danger
        busy={remove.isPending}
        disabled={typedName.trim() !== name(user)}
        onClose={() => setDeleting(false)}
        onConfirm={() => void run(remove.mutateAsync(user.id), `Compte de ${name(user)} supprimé`, onClose)}
      >
        <Field label={`Retapez « ${name(user)} » pour confirmer`}>
          {(id) => <TextInput id={id} value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />}
        </Field>
        <p className={[layout.muted, layout.small].join(' ')}>Ses demandes restent archivées sans être rattachées à la personne.</p>
      </Confirm>
    </>
  )
}

function SecurityTab({ user }: { user: ManagedUser }) {
  const now = useNow()
  const security = useUserSecurity(user.id)
  const unlock = useUnlockUser()
  const revokeSessions = useRevokeSessions()
  const resetTwoFactor = useResetTwoFactor()
  const revokePasskeys = useRevokePasskeys()
  const [confirm, setConfirm] = useState<'sessions' | '2fa' | 'passkeys' | null>(null)
  const data = security.data

  const act = (promise: Promise<unknown>, done: string) =>
    promise.then(
      () => {
        toast(done)
        setConfirm(null)
        void security.refetch()
      },
      (error) => toast(messageFor(error), 'alert'),
    )

  if (security.isError) return <EmptyState title={messageFor(security.error)} icon="alert" />
  if (!data) return <Skeleton lines={6} />

  return (
    <>
      <dl className={layout.dl}>
        <dt>Connexion</dt>
        <dd>{data.login_locked ? `Verrouillée${data.locked_until ? ` jusqu’à ${formatDateTime(data.locked_until)}` : ''}` : 'Normale'}</dd>
        <dt>Double vérification</dt>
        <dd>{data.two_factor_enabled_at ? `Activée le ${formatDateTime(data.two_factor_enabled_at)}` : 'Non activée'}</dd>
        <dt>Clés d’accès</dt>
        <dd>{data.passkeys.length === 0 ? 'Aucune' : data.passkeys.map((p) => p.label).join(', ')}</dd>
        <dt>Dernière connexion</dt>
        <dd>{user.last_login_at ? formatRelative(user.last_login_at, now) : 'Jamais'}</dd>
      </dl>

      <div className={layout.row}>
        {data.login_locked && (
          <Button icon="unlock" onClick={() => void act(unlock.mutateAsync(user.id), 'Connexion débloquée')}>
            Débloquer
          </Button>
        )}
        <Button onClick={() => setConfirm('sessions')}>Déconnecter tous les appareils</Button>
        {data.two_factor_enabled_at && <Button onClick={() => setConfirm('2fa')}>Réinitialiser la double vérification</Button>}
        {data.passkeys.length > 0 && <Button onClick={() => setConfirm('passkeys')}>Révoquer les clés d’accès</Button>}
      </div>

      <p className={layout.sectionLabel}>Appareils connus (F54)</p>
      {data.devices.length === 0 ? (
        <p className={layout.muted}>Aucun appareil enregistré.</p>
      ) : (
        <ul className={layout.stack} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.devices.map((device) => (
            <li key={device.id}>
              <strong>{device.label}</strong>
              <span className={[layout.muted, layout.small].join(' ')} style={{ display: 'block' }}>
                Vu {formatRelative(device.last_seen, now)} · première fois le {formatDateTime(device.first_seen)}
                {device.last_ip ? ` · IP ${device.last_ip}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Confirm
        open={confirm === 'sessions'}
        title="Déconnecter tous les appareils ?"
        confirm="Déconnecter"
        danger
        busy={revokeSessions.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void act(revokeSessions.mutateAsync(user.id), `${name(user)} est déconnecté·e de tous ses appareils`)}
      >
        <p>Toutes les sessions ouvertes de ce compte s’arrêtent à leur prochaine requête. La personne devra se reconnecter.</p>
      </Confirm>
      <Confirm
        open={confirm === '2fa'}
        title="Réinitialiser la double vérification ?"
        confirm="Réinitialiser"
        danger
        busy={resetTwoFactor.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void act(resetTwoFactor.mutateAsync(user.id), 'Double vérification réinitialisée · la personne est prévenue')}
      >
        <p>À utiliser quand la personne a perdu son téléphone. Elle est prévenue et devra l’activer de nouveau.</p>
      </Confirm>
      <Confirm
        open={confirm === 'passkeys'}
        title="Révoquer toutes les clés d’accès ?"
        confirm="Révoquer"
        danger
        busy={revokePasskeys.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => void act(revokePasskeys.mutateAsync(user.id), 'Clés d’accès révoquées')}
      >
        <p>La personne ne pourra plus se connecter sans mot de passe tant qu’elle n’aura pas ajouté une nouvelle clé.</p>
      </Confirm>
    </>
  )
}
