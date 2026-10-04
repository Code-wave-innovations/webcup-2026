import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useDistricts } from '../../../api/districts'
import { isApiError, messageFor } from '../../../api/errors'
import type { ManagedUser, Role } from '../../../api/types'
import { useCreateUser, useUserStats, useUsers } from '../../../api/users'
import { useApiForm } from '../../../hooks/useApiForm'
import { formatRelative } from '../../lib/format'
import { ROLE_LABEL } from '../../lib/labels'
import { temporaryPassword } from '../../lib/tempPassword'
import { useNow } from '../../lib/useNow'
import { AccountDrawer } from '../../shared/AccountDrawer'
import { toast } from '../../stores/toastStore'
import { Flag, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, SearchInput, Select, Tabs, TextInput } from '../../ui/Controls'
import { DataTable, type Column } from '../../ui/DataTable'
import { Avatar, EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const ROLES: Role[] = ['CITIZEN', 'AGENT', 'ADMIN']
const PAGE_SIZE = 25

/** F34 / D08 / D09: citizen accounts, agents and administrators. Filters and the open account live in the URL. */
export default function UsersPage() {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const role = (ROLES.find((r) => r === params.get('role')) ?? 'CITIZEN') as Role
  const q = params.get('q') ?? ''
  const district = Number(params.get('quartier')) || undefined
  const state = params.get('etat') === 'actifs' ? true : params.get('etat') === 'desactives' ? false : undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const openId = Number(params.get('compte')) || null
  const [creating, setCreating] = useState(false)

  const update = (changes: Record<string, string | null>, keepPage = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!keepPage) next.delete('page')
        return next
      },
      { replace: true },
    )

  const [search, setSearch] = useState(q)
  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text restarts the timer
  }, [search])

  const list = useUsers({ role, q: q || undefined, district_id: district, is_active: state, page, limit: PAGE_SIZE })
  const stats = useUserStats().data
  const districts = useDistricts().data ?? []
  const meta = list.data?.meta

  const columns: Column<ManagedUser>[] = [
    {
      key: 'name',
      header: 'Compte',
      sortValue: (u) => `${u.last_name} ${u.name}`,
      cell: (u) => (
        <span className={layout.row} style={{ flexWrap: 'nowrap' }}>
          <Avatar name={u.name} lastName={u.last_name} size={30} tone={u.role === 'ADMIN' ? 'ember' : u.is_active ? 'ice' : 'neutral'} />
          <span>
            <span className={layout.strong}>
              {u.name} {u.last_name}
            </span>
            <span className={[layout.muted, layout.small].join(' ')} style={{ display: 'block' }}>
              {u.email}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'district', header: 'Quartier', hideOnPhone: true, cell: (u) => <span className={layout.muted}>{u.district?.name ?? '—'}</span>, sortValue: (u) => u.district?.name ?? '' },
    {
      key: 'state',
      header: 'État',
      cell: (u) => (
        <span className={layout.row}>
          <Tag tone={u.is_active ? 'ok' : 'alert'}>{u.is_active ? 'Actif' : 'Désactivé'}</Tag>
          {u.login_locked && <Flag icon="lock" tone="alert">Verrouillé</Flag>}
          {u.is_vulnerable && <Flag icon="alert" tone="progress">Vulnérable</Flag>}
        </span>
      ),
    },
    {
      key: 'twofa',
      header: 'Double vérification',
      hideOnPhone: true,
      sortValue: (u) => (u.two_factor_enabled_at ? 1 : 0),
      cell: (u) =>
        u.two_factor_enabled_at ? (
          <span className={layout.row} style={{ color: 'var(--color-ok)' }}>
            <Icon name="check" size={14} /> Oui
          </span>
        ) : (
          <span className={[layout.row, layout.muted].join(' ')}>
            <Icon name="close" size={14} /> Non
          </span>
        ),
    },
    {
      key: 'login',
      header: 'Dernière connexion',
      hideOnPhone: true,
      sortValue: (u) => (u.last_login_at ? -new Date(u.last_login_at).getTime() : 0),
      cell: (u) => <span className={layout.small}>{u.last_login_at ? formatRelative(u.last_login_at, now) : 'Jamais'}</span>,
    },
  ]

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Utilisateurs"
        codes={['F34', 'D08', 'D09']}
        lead="Gérez les comptes citoyens et le personnel. Les mots de passe ne sont jamais visibles ; un compte désactivé perd l’accès immédiatement."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Compte agent / admin
          </Button>
        }
      />

      <Tabs<Role>
        idPrefix="users"
        label="Type de compte"
        value={role}
        onChange={(value) => update({ role: value === 'CITIZEN' ? null : value })}
        tabs={[
          { value: 'CITIZEN', label: 'Citoyens', count: stats?.by_role.CITIZEN },
          { value: 'AGENT', label: 'Agents', count: stats?.by_role.AGENT },
          { value: 'ADMIN', label: 'Administrateurs', count: stats?.by_role.ADMIN },
        ]}
      />

      <Panel
        flush
        id="users-panel"
        role="tabpanel"
        aria-labelledby={`users-tab-${role}`}
        aria-busy={list.isFetching}
        title={meta ? `${meta.total} compte${meta.total > 1 ? 's' : ''}` : 'Comptes'}
        kicker={stats ? `${ROLE_LABEL[role]} · ${stats.locked} verrouillé${stats.locked > 1 ? 's' : ''} · ${stats.inactive} désactivé${stats.inactive > 1 ? 's' : ''} au total` : ROLE_LABEL[role]}
      >
        <div className={layout.toolbar}>
          <SearchInput label="Nom ou e-mail (touche /)" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Quartier" value={district ?? ''} onChange={(e) => update({ quartier: e.target.value || null })}>
            <option value="">Tous les quartiers</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select aria-label="État du compte" value={params.get('etat') ?? ''} onChange={(e) => update({ etat: e.target.value || null })}>
            <option value="">Tous les états</option>
            <option value="actifs">Actifs</option>
            <option value="desactives">Désactivés</option>
          </Select>
        </div>
        {list.data ? (
          <DataTable caption={`Comptes : ${ROLE_LABEL[role]}`} columns={columns} rows={list.data.data} rowKey={(u) => u.id} onRowClick={(u) => update({ compte: String(u.id) }, true)} empty="Aucun compte ne correspond." />
        ) : list.isError ? (
          <EmptyState title={messageFor(list.error)} icon="alert" />
        ) : (
          <Skeleton lines={8} />
        )}
        {meta && meta.pages > 1 && (
          <nav className={layout.toolbar} aria-label="Pages">
            <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
              Précédente
            </Button>
            <span aria-current="page">
              Page {meta.page} sur {meta.pages}
            </span>
            <Button size="sm" disabled={page >= meta.pages} onClick={() => update({ page: String(page + 1) }, true)}>
              Suivante
            </Button>
          </nav>
        )}
      </Panel>

      <AccountDrawer userId={openId} onClose={() => update({ compte: null }, true)} />
      <CreateStaffModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => update({ role: created === 'CITIZEN' ? null : created })}
      />
    </motion.div>
  )
}

/** D08: a staff account with a temporary password, shown once */
function CreateStaffModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (role: Role) => void }) {
  const create = useCreateUser()
  const empty = { name: '', last_name: '', email: '', role: 'AGENT' as Role }
  const [draft, setDraft] = useState(empty)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const form = useApiForm({
    labels: { name: 'Prénom', last_name: 'Nom', email: 'E-mail professionnel', password: 'Mot de passe' },
    describeError: (error) => (isApiError(error) && error.status === 409 ? 'Cet e-mail est déjà utilisé.' : null),
    submit: async () => {
      const password = temporaryPassword()
      await create.mutateAsync({ ...draft, name: draft.name.trim(), last_name: draft.last_name.trim(), email: draft.email.trim(), password })
      return { email: draft.email.trim(), password }
    },
    onSuccess: (result) => {
      setCreated(result)
      onCreated(draft.role)
      toast(`Compte ${draft.role === 'ADMIN' ? 'administrateur' : 'agent'} créé`)
    },
  })

  const close = () => {
    setCreated(null)
    setDraft(empty)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      kicker="D08 · Personnel"
      title={created ? 'Compte créé' : 'Créer un compte agent ou administrateur'}
      footer={
        created ? (
          <Button variant="primary" onClick={close}>
            J’ai transmis le mot de passe
          </Button>
        ) : (
          <>
            <Button variant="subtle" onClick={close}>
              Annuler
            </Button>
            <Button variant="primary" icon="plus" type="submit" form="create-staff" disabled={form.pending} aria-busy={form.pending}>
              Créer le compte
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className={layout.stack}>
          <p>
            Mot de passe provisoire de <strong>{created.email}</strong>, affiché <strong>une seule fois</strong> :
          </p>
          <div className={layout.row}>
            <code style={{ fontSize: 18, letterSpacing: 1 }}>{created.password}</code>
            <Button
              size="sm"
              icon="file"
              onClick={() =>
                navigator.clipboard.writeText(created.password).then(
                  () => toast('Mot de passe copié', 'info'),
                  () => toast('Copie impossible : recopiez-le à la main', 'alert'),
                )
              }
            >
              Copier
            </Button>
          </div>
          <p className={[layout.muted, layout.small].join(' ')}>À changer à la première connexion, depuis « Mon compte ». Il n’est conservé nulle part en clair.</p>
        </div>
      ) : (
        <form
          id="create-staff"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit(undefined)
          }}
          className={layout.stack}
        >
          <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
          <div className={layout.formGrid}>
            <Field id={form.fieldId('name')} label="Prénom" required error={form.errors.name}>
              {(id, describedBy, invalid) => <TextInput id={id} data-autofocus aria-describedby={describedBy} aria-invalid={invalid} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
            </Field>
            <Field id={form.fieldId('last_name')} label="Nom" required error={form.errors.last_name}>
              {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />}
            </Field>
            <div className={layout.full}>
              <Field id={form.fieldId('email')} label="E-mail professionnel" required error={form.errors.email}>
                {(id, describedBy, invalid) => <TextInput id={id} type="email" aria-describedby={describedBy} aria-invalid={invalid} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />}
              </Field>
            </div>
            <Field label="Rôle">
              {(id) => (
                <Select id={id} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
                  <option value="AGENT">Agent municipal</option>
                  <option value="ADMIN">Administrateur</option>
                </Select>
              )}
            </Field>
          </div>
        </form>
      )}
    </Modal>
  )
}
