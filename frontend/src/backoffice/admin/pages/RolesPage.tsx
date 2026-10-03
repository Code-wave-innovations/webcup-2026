import { motion } from 'motion/react'
import { PERMISSIONS } from '../../mocks/config'
import type { Role } from '../../mocks/types'
import { togglePermission, useConfigStore } from '../../stores/configStore'
import { useUserStore } from '../../stores/userStore'
import { Flag } from '../../ui/Badges'
import { Toggle } from '../../ui/Controls'
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

/** D08 / D09: which profile can do what. Admin keeps every right so the platform can't be locked out. */
export default function RolesPage() {
  const matrix = useConfigStore((s) => s.rolePermissions)
  const users = useUserStore((s) => s.users)
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))]

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Rôles & permissions"
        codes={['D08', 'D09']}
        lead="Chaque profil n’accède qu’aux outils de sa responsabilité. Les droits sensibles sont signalés ; tout changement est tracé dans le journal d’audit."
      />

      <motion.div className={layout.stats} variants={stagger}>
        {ROLES.map(({ role, label }) => (
          <StatTile
            key={role}
            label={`${label}s`}
            value={users.filter((u) => u.role === role).length * (role === 'CITIZEN' ? 124 : 1)}
            icon={role === 'ADMIN' ? 'key' : role === 'AGENT' ? 'user' : 'users'}
            tone={role === 'ADMIN' ? 'ember' : role === 'AGENT' ? 'ice' : 'neutral'}
            hint={`${matrix[role].length} permission${matrix[role].length > 1 ? 's' : ''}`}
          />
        ))}
      </motion.div>

      <Panel kicker="Matrice" title="Permissions par rôle" flush>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.matrix}>
            <caption className="bo-sr-only">Permissions accordées à chaque rôle</caption>
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
                <PermissionGroup key={group} group={group} matrix={matrix} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </motion.div>
  )
}

function PermissionGroup({ group, matrix }: { group: string; matrix: Record<Role, string[]> }) {
  return (
    <>
      <tr className={styles.group}>
        <th colSpan={4} scope="colgroup">
          {group}
        </th>
      </tr>
      {PERMISSIONS.filter((p) => p.group === group).map((permission) => (
        <tr key={permission.key}>
          <th scope="row">
            <span className={styles.permName}>
              <span className={layout.row}>
                {permission.label}
                {permission.sensitive && <Flag icon="lock" tone="alert">Sensible</Flag>}
              </span>
              <small>{permission.description}</small>
            </span>
          </th>
          {ROLES.map(({ role }) => {
            const granted = matrix[role].includes(permission.key)
            if (role === 'ADMIN') {
              return (
                <td key={role}>
                  <span className={styles.locked} title="Toujours accordé aux administrateurs">
                    <Icon name="lock" size={14} /> Toujours
                  </span>
                </td>
              )
            }
            if (role === 'CITIZEN') {
              return (
                <td key={role}>
                  <span className={styles.locked}>—</span>
                </td>
              )
            }
            return (
              <td key={role}>
                <Toggle hideLabel checked={granted} onChange={() => togglePermission(role, permission.key)} label={`${permission.label} pour le rôle ${role}`} />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
