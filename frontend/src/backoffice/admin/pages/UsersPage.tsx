import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { ROLE_LABEL } from '../../lib/labels'
import { formatRelative } from '../../lib/format'
import { districtName } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import { DISTRICTS } from '../../mocks/people'
import type { Role, User } from '../../mocks/types'
import { CitizenCard } from '../../shared/CitizenCard'
import { changeRole, createStaff, setActive, unlockLogin, updateProfile, useUserStore } from '../../stores/userStore'
import { Flag, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, SearchInput, Select, Tabs, TextInput, Toggle } from '../../ui/Controls'
import { DataTable, type Column } from '../../ui/DataTable'
import { Avatar } from '../../ui/Feedback'
import { Drawer, Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Tab = Role
type StatusFilter = 'all' | 'active' | 'inactive' | 'locked'

/** F34 / D08: citizen accounts, agents and administrators. */
export default function UsersPage() {
  const actor = useActor()
  const now = useNow()
  const users = useUserStore((s) => s.users)
  const [tab, setTab] = useState<Tab>('CITIZEN')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', last_name: '', email: '', role: 'AGENT' as Role })
  const [profile, setProfile] = useState<Pick<User, 'phone' | 'address' | 'district_id' | 'is_vulnerable'>>({ phone: null, address: null, district_id: null, is_vulnerable: false })

  const q = query.trim().toLowerCase()
  const rows = users
    .filter((u) => u.role === tab)
    .filter((u) => !q || `${u.name} ${u.last_name} ${u.email}`.toLowerCase().includes(q))
    .filter((u) => status === 'all' || (status === 'active' ? u.is_active : status === 'inactive' ? !u.is_active : u.login_locked))
  const editing = users.find((u) => u.id === editingId)

  const openEdit = (u: User) => {
    setEditingId(u.id)
    setProfile({ phone: u.phone, address: u.address, district_id: u.district_id, is_vulnerable: u.is_vulnerable })
  }

  const columns: Column<User>[] = [
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
    {
      key: 'role',
      header: 'Rôle',
      cell: (u) =>
        u.role === 'CITIZEN' ? (
          <Tag tone="neutral">Citoyen</Tag>
        ) : (
          <Select aria-label={`Rôle de ${u.name}`} value={u.role} onClick={(e) => e.stopPropagation()} onChange={(e) => changeRole(u.id, e.target.value as Role, actor.id)} disabled={u.id === actor.id}>
            <option value="AGENT">Agent</option>
            <option value="ADMIN">Administrateur</option>
          </Select>
        ),
    },
    { key: 'district', header: 'Quartier', hideOnPhone: true, cell: (u) => <span className={layout.muted}>{districtName(u.district_id)}</span>, sortValue: (u) => districtName(u.district_id) },
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
      key: 'login',
      header: 'Dernière connexion',
      hideOnPhone: true,
      sortValue: (u) => (u.last_login_at ? -new Date(u.last_login_at).getTime() : 0),
      cell: (u) => <span className={layout.small}>{u.last_login_at ? formatRelative(u.last_login_at, now) : 'Jamais'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'end',
      cell: (u) => (
        <span className={layout.row} style={{ justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {u.login_locked && (
            <Button size="sm" icon="unlock" onClick={() => unlockLogin(u.id, actor.id)}>
              Déverrouiller
            </Button>
          )}
          <Toggle hideLabel label={`${u.is_active ? 'Désactiver' : 'Réactiver'} ${u.name} ${u.last_name}`} checked={u.is_active} disabled={u.id === actor.id} onChange={(v) => setActive(u.id, v, actor.id)} />
        </span>
      ),
    },
  ]

  const count = (role: Role) => users.filter((u) => u.role === role).length

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Utilisateurs"
        codes={['F34', 'D08']}
        lead="Gérez les comptes citoyens et le personnel. Les mots de passe ne sont jamais visibles ; un compte désactivé perd l’accès immédiatement."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Compte agent / admin
          </Button>
        }
      />

      <Tabs<Tab>
        idPrefix="users"
        label="Type de compte"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'CITIZEN', label: 'Citoyens', count: count('CITIZEN') },
          { value: 'AGENT', label: 'Agents', count: count('AGENT') },
          { value: 'ADMIN', label: 'Administrateurs', count: count('ADMIN') },
        ]}
      />

      <Panel flush id="users-panel" role="tabpanel" aria-labelledby={`users-tab-${tab}`} title={`${rows.length} compte${rows.length > 1 ? 's' : ''}`} kicker={ROLE_LABEL[tab]}>
        <div className={layout.toolbar}>
          <SearchInput label="Nom ou e-mail (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select aria-label="État du compte" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Tous les états</option>
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
            <option value="locked">Connexion verrouillée</option>
          </Select>
        </div>
        <DataTable caption={`Comptes : ${ROLE_LABEL[tab]}`} columns={columns} rows={rows} rowKey={(u) => u.id} onRowClick={openEdit} empty="Aucun compte ne correspond." />
      </Panel>

      <Drawer
        open={!!editing}
        onClose={() => setEditingId(null)}
        kicker={editing ? ROLE_LABEL[editing.role] : ''}
        title={editing ? `${editing.name} ${editing.last_name}` : ''}
        footer={
          editing && (
            <Button variant="primary" icon="check" onClick={() => updateProfile(editing.id, profile, actor.id)}>
              Enregistrer
            </Button>
          )
        }
      >
        {editing && (
          <>
            <CitizenCard citizen={editing} />
            <hr className={layout.divider} />
            <div className={layout.formGrid}>
              <Field label="Téléphone">
                {(id) => <TextInput id={id} value={profile.phone ?? ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })} />}
              </Field>
              <Field label="Quartier">
                {(id) => (
                  <Select id={id} value={profile.district_id ?? ''} onChange={(e) => setProfile({ ...profile, district_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {DISTRICTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className={layout.full}>
                <Field label="Adresse">
                  {(id) => <TextInput id={id} value={profile.address ?? ''} onChange={(e) => setProfile({ ...profile, address: e.target.value || null })} />}
                </Field>
              </div>
            </div>
            <Toggle checked={profile.is_vulnerable} onChange={(v) => setProfile({ ...profile, is_vulnerable: v })} label="Personne vulnérable (ciblée par les alertes sanitaires F31)" />
            <p className={[layout.muted, layout.small].join(' ')}>
              L’e-mail et le mot de passe ne peuvent pas être modifiés ici : le citoyen garde seul l’accès à son espace.
            </p>
          </>
        )}
      </Drawer>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        kicker="D08 · Personnel"
        title="Créer un compte agent ou administrateur"
        footer={
          <>
            <Button variant="subtle" onClick={() => setCreating(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              icon="plus"
              disabled={!draft.name || !draft.last_name || !draft.email.includes('@')}
              onClick={() => {
                createStaff(draft, actor.id)
                setCreating(false)
                setDraft({ name: '', last_name: '', email: '', role: 'AGENT' })
                setTab(draft.role)
              }}
            >
              Créer le compte
            </Button>
          </>
        }
      >
        <div className={layout.formGrid}>
          <Field label="Prénom">{(id) => <TextInput id={id} data-autofocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
          <Field label="Nom">{(id) => <TextInput id={id} value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />}</Field>
          <div className={layout.full}>
            <Field label="E-mail professionnel" hint="Un lien d’activation lui sera envoyé pour choisir son mot de passe.">
              {(id, describedBy) => <TextInput id={id} type="email" aria-describedby={describedBy} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />}
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
      </Modal>
    </motion.div>
  )
}
