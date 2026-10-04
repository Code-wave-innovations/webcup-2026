import { useState } from 'react'
import { motion } from 'motion/react'
import { messageFor } from '../../../api/errors'
import { usePermissions } from '../../../api/permissions'
import type { Permission, PermissionRoute, Role } from '../../../api/types'
import { useUserStats } from '../../../api/users'
import { Flag } from '../../ui/Badges'
import { Select } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const ROLES: { role: Role; label: string }[] = [
  { role: 'CITIZEN', label: 'Citoyen' },
  { role: 'AGENT', label: 'Agent' },
  { role: 'ADMIN', label: 'Admin' },
]

/** What the server answers to each role for a route, given its guard (D09) */
function expected(route: PermissionRoute, role: Role | 'ANONYMOUS'): string {
  if (role === 'ANONYMOUS') return '401'
  const allowed = route.guard === 'authenticated' || (route.guard === 'staff' && role !== 'CITIZEN') || (route.guard === 'admin' && role === 'ADMIN')
  if (!allowed) return '403'
  return route.method === 'POST' ? '200 / 201' : '200'
}

/** D08 / D09: who can do what, as the server applies it. Read-only: the matrix describes, it does not change rights. */
export default function RolesPage() {
  const permissions = usePermissions()
  const stats = useUserStats().data
  const [checking, setChecking] = useState('')
  const list = permissions.data ?? []
  const groups = [...new Set(list.map((p) => p.group))]
  const checked = list.find((p) => p.key === checking) ?? list.find((p) => p.sensitive) ?? list[0]

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Rôles & permissions"
        codes={['D08', 'D09']}
        lead="Les droits sont appliqués par le serveur. Ce tableau les décrit, il ne les modifie pas : un test vérifie qu’il reste conforme aux routes."
      />

      <motion.div className={layout.stats} variants={stagger}>
        {ROLES.map(({ role, label }) => (
          <StatTile
            key={role}
            label={`${label}s`}
            value={stats?.by_role[role] ?? null}
            icon={role === 'ADMIN' ? 'key' : role === 'AGENT' ? 'user' : 'users'}
            tone={role === 'ADMIN' ? 'ember' : role === 'AGENT' ? 'ice' : 'neutral'}
            hint={permissions.data ? `${list.filter((p) => p.roles.includes(role)).length} permission(s)` : undefined}
          />
        ))}
      </motion.div>

      <Panel kicker="Matrice" title="Permissions par rôle" flush>
        {!permissions.data ? (
          permissions.isError ? <EmptyState title={messageFor(permissions.error)} icon="alert" /> : <Skeleton lines={10} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.matrix}>
              <caption className="bo-sr-only">Permissions accordées à chaque rôle, telles que le serveur les applique</caption>
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  {ROLES.map((r) => (
                    <th key={r.role} scope="col">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <PermissionGroup key={group} group={group} permissions={list.filter((p) => p.group === group)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {checked && (
        <Panel kicker="D09 · Vérifier un droit" title="Ce que répond le serveur">
          <Select aria-label="Permission à vérifier" value={checked.key} onChange={(e) => setChecking(e.target.value)}>
            {list.map((p) => (
              <option key={p.key} value={p.key}>
                {p.group} · {p.label}
              </option>
            ))}
          </Select>
          {checked.rule && <p className={layout.muted}>{checked.rule}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.matrix}>
              <caption className="bo-sr-only">Réponse attendue pour chaque rôle et chaque route de « {checked.label} »</caption>
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Sans session</th>
                  {ROLES.map((r) => (
                    <th key={r.role} scope="col">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checked.routes.map((route) => (
                  <tr key={`${route.method} ${route.path}`}>
                    <th scope="row">
                      <code>
                        {route.method} {route.path}
                      </code>
                    </th>
                    {(['ANONYMOUS', 'CITIZEN', 'AGENT', 'ADMIN'] as const).map((role) => {
                      const code = expected(route, role)
                      const ok = code.startsWith('2')
                      return (
                        <td key={role}>
                          <span className={layout.row} style={{ color: ok ? 'var(--color-ok)' : 'var(--color-alert)' }}>
                            <Icon name={ok ? 'check' : 'close'} size={14} /> {code} {ok ? 'autorisé' : 'refusé'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </motion.div>
  )
}

function PermissionGroup({ group, permissions }: { group: string; permissions: Permission[] }) {
  return (
    <>
      <tr className={styles.group}>
        <th colSpan={4} scope="colgroup">
          {group}
        </th>
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.key}>
          <th scope="row">
            <span className={styles.permName}>
              <span className={layout.row}>
                {permission.label}
                {permission.sensitive && (
                  <Flag icon="lock" tone="alert">
                    Sensible
                  </Flag>
                )}
              </span>
              <small>{permission.description}</small>
            </span>
          </th>
          {ROLES.map(({ role, label }) => {
            const granted = permission.roles.includes(role)
            return (
              <td key={role}>
                <span className={styles.locked} style={{ color: granted ? 'var(--color-ok)' : undefined }} aria-label={`${label} : ${granted ? 'oui' : 'non'}`}>
                  <Icon name={granted ? 'check' : 'close'} size={14} /> {granted ? 'Oui' : 'Non'}
                </span>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
