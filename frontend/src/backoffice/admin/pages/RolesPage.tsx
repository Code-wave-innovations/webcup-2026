import { useState } from 'react'
import { motion } from 'motion/react'
import { http } from '../../../api/client'
import { isApiError, messageFor } from '../../../api/errors'
import { usePermissions, useUpdatePermissionRoles } from '../../../api/permissions'
import { useStaffUser } from '../../../api/session'
import type { Permission, PermissionRoute, Role } from '../../../api/types'
import { useUserStats } from '../../../api/users'
import { Flag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { toast } from '../../stores/toastStore'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

type LiveStatus = number | 'pending' | 'skip' | 'error'
type StaffRole = 'AGENT' | 'ADMIN'

/** GET routes without path params — safe to probe with the current staff session (D09). */
function probeableGets(routes: PermissionRoute[]): PermissionRoute[] {
  return routes.filter((route) => route.method === 'GET' && !route.path.includes(':'))
}

async function probeRoute(route: PermissionRoute): Promise<number> {
  const url = route.path.replace(/^\/api/, '')
  try {
    const res = await http.request({ method: route.method, url })
    return res.status
  } catch (error) {
    if (isApiError(error) && error.status > 0) return error.status
    throw error
  }
}

const ROLES: { role: Role; label: string }[] = [
  { role: 'CITIZEN', label: 'Citoyen' },
  { role: 'AGENT', label: 'Agent' },
  { role: 'ADMIN', label: 'Admin' },
]

/** Predicted HTTP outcome from the effective roles on this permission (D09). */
function expected(permission: Permission, route: PermissionRoute, role: Role | 'ANONYMOUS'): string {
  if (role === 'ANONYMOUS') return '401'
  if (!permission.roles.includes(role)) return '403'
  return route.method === 'POST' ? '200 / 201' : '200'
}

/** D08 / D09: matrix of effective rights — Agent/Admin editable; Citoyen locked. */
export default function RolesPage() {
  const permissions = usePermissions()
  const staff = useStaffUser()
  const stats = useUserStats().data
  const [checking, setChecking] = useState('')
  const [live, setLive] = useState<Record<string, LiveStatus>>({})
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const list = permissions.data ?? []
  const groups = [...new Set(list.map((p) => p.group))]
  const checked = list.find((p) => p.key === checking) ?? list.find((p) => p.sensitive) ?? list[0]
  const roleLabel = staff?.role === 'ADMIN' ? 'Admin' : staff?.role === 'AGENT' ? 'Agent' : 'session'
  const gets = checked ? probeableGets(checked.routes) : []
  const canEditMatrix = !!staff && list.some((p) => p.key === 'permissions.manage' && p.roles.includes(staff.role))

  const runLiveProbe = async () => {
    if (!checked || gets.length === 0) return
    setProbing(true)
    setProbeError(null)
    const next: Record<string, LiveStatus> = {}
    for (const route of gets) next[`${route.method} ${route.path}`] = 'pending'
    setLive(next)
    try {
      for (const route of gets) {
        const key = `${route.method} ${route.path}`
        try {
          const status = await probeRoute(route)
          next[key] = status
        } catch {
          next[key] = 'error'
        }
        setLive({ ...next })
      }
    } catch (error) {
      setProbeError(messageFor(error))
    } finally {
      setProbing(false)
    }
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Rôles & permissions"
        lead="Les droits sont appliqués par le serveur. Cochez Agent ou Admin pour modifier une permission ; la colonne Citoyen reste verrouillée. Un test vérifie les réponses HTTP."
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
                      {r.role === 'CITIZEN' && (
                        <span className={layout.muted} style={{ display: 'block', fontWeight: 400, fontSize: 12 }}>
                          verrouillé
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <PermissionGroup key={group} group={group} permissions={list.filter((p) => p.group === group)} canEdit={canEditMatrix} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {checked && (
        <Panel
          kicker="D09 · Vérifier un droit"
          title="Ce que répond le serveur"
          actions={
            <Button icon="lock" variant="primary" size="sm" onClick={() => void runLiveProbe()} disabled={probing || gets.length === 0} aria-busy={probing}>
              {probing ? 'Test en cours…' : 'Tester maintenant'}
            </Button>
          }
        >
          <Select
            aria-label="Permission à vérifier"
            value={checked.key}
            onChange={(e) => {
              setChecking(e.target.value)
              setLive({})
              setProbeError(null)
            }}
          >
            {list.map((p) => (
              <option key={p.key} value={p.key}>
                {p.group} · {p.label}
              </option>
            ))}
          </Select>
          {checked.rule && <p className={layout.muted}>{checked.rule}</p>}
          <p className={layout.muted}>
            Prédiction pour chaque rôle, puis statut HTTP réel avec votre session <strong>{roleLabel}</strong>
            {gets.length === 0 ? ' (aucun GET sans paramètre à sonder pour cette permission).' : '.'}
          </p>
          {probeError && (
            <p className={layout.muted} style={{ color: 'var(--color-alert)' }}>
              {probeError}
            </p>
          )}
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
                  <th scope="col">Live ({roleLabel})</th>
                </tr>
              </thead>
              <tbody>
                {checked.routes.map((route) => {
                  const key = `${route.method} ${route.path}`
                  const liveStatus = live[key]
                  const canProbe = route.method === 'GET' && !route.path.includes(':')
                  return (
                    <tr key={key}>
                      <th scope="row">
                        <code>
                          {route.method} {route.path}
                        </code>
                      </th>
                      {(['ANONYMOUS', 'CITIZEN', 'AGENT', 'ADMIN'] as const).map((role) => {
                        const code = expected(checked, route, role)
                        const ok = code.startsWith('2')
                        return (
                          <td key={role}>
                            <span className={layout.row} style={{ color: ok ? 'var(--color-ok)' : 'var(--color-alert)' }}>
                              <Icon name={ok ? 'check' : 'close'} size={14} /> {code} {ok ? 'autorisé' : 'refusé'}
                            </span>
                          </td>
                        )
                      })}
                      <td>
                        <LiveCell status={canProbe ? liveStatus : 'skip'} expected={staff ? expected(checked, route, staff.role) : '401'} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </motion.div>
  )
}

function LiveCell({ status, expected }: { status: LiveStatus | undefined; expected: string }) {
  if (status === undefined) return <span className={layout.muted}>—</span>
  if (status === 'skip')
    return (
      <span className={layout.muted} title="Pas de GET sans paramètre">
        n/a
      </span>
    )
  if (status === 'pending') return <span className={layout.muted}>…</span>
  if (status === 'error') {
    return (
      <span className={layout.row} style={{ color: 'var(--color-alert)' }}>
        <Icon name="alert" size={14} /> erreur réseau
      </span>
    )
  }
  const predictedOk = expected.startsWith('2')
  const liveOk = status >= 200 && status < 300
  const match = predictedOk === liveOk
  return (
    <span className={layout.row} style={{ color: liveOk ? 'var(--color-ok)' : 'var(--color-alert)' }} title={match ? 'Conforme à la prédiction' : `Prédiction ${expected}`}>
      <Icon name={liveOk ? 'check' : 'close'} size={14} /> {status} {liveOk ? 'autorisé' : 'refusé'}
      {!match && (
        <Flag icon="alert" tone="alert">
          ≠ {expected}
        </Flag>
      )}
    </span>
  )
}

function PermissionGroup({ group, permissions, canEdit }: { group: string; permissions: Permission[]; canEdit: boolean }) {
  return (
    <>
      <tr className={styles.group}>
        <th colSpan={4} scope="colgroup">
          {group}
        </th>
      </tr>
      {permissions.map((permission) => (
        <PermissionRow key={permission.key} permission={permission} canEdit={canEdit} />
      ))}
    </>
  )
}

function PermissionRow({ permission, canEdit }: { permission: Permission; canEdit: boolean }) {
  const update = useUpdatePermissionRoles()
  const editable = new Set(permission.editable_roles ?? [])
  const locked = new Set(permission.locked_roles ?? [])

  const toggle = (role: StaffRole, on: boolean) => {
    const next = new Set(permission.roles.filter((r): r is StaffRole => r === 'AGENT' || r === 'ADMIN'))
    if (on) next.add(role)
    else next.delete(role)
    for (const keep of locked) next.add(keep)
    update.mutate(
      { key: permission.key, roles: [...next] },
      {
        onSuccess: () => toast(on ? `« ${permission.label} » accordé à ${role === 'AGENT' ? 'Agent' : 'Admin'}` : `« ${permission.label} » retiré à ${role === 'AGENT' ? 'Agent' : 'Admin'}`, 'ok'),
        onError: (error) => toast(messageFor(error), 'alert'),
      },
    )
  }

  return (
    <tr>
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
        if (role === 'CITIZEN' || !canEdit || !editable.has(role as StaffRole)) {
          return (
            <td key={role}>
              <span className={styles.locked} style={{ color: granted ? 'var(--color-ok)' : undefined }} aria-label={`${label} : ${granted ? 'oui' : 'non'} (non modifiable)`}>
                <Icon name={granted ? 'check' : 'close'} size={14} /> {granted ? 'Oui' : 'Non'}
                {role !== 'CITIZEN' && locked.has(role as StaffRole) && (
                  <Flag icon="lock" tone="neutral">
                    Fixé
                  </Flag>
                )}
              </span>
            </td>
          )
        }
        return (
          <td key={role}>
            <label className={styles.locked} style={{ cursor: update.isPending ? 'wait' : 'pointer', color: granted ? 'var(--color-ok)' : undefined }}>
              <input
                type="checkbox"
                checked={granted}
                disabled={update.isPending}
                onChange={(e) => toggle(role as StaffRole, e.target.checked)}
                aria-label={`${permission.label} pour ${label}`}
              />{' '}
              {granted ? 'Oui' : 'Non'}
            </label>
          </td>
        )
      })}
    </tr>
  )
}
