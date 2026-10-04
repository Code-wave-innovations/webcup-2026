import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useSecurityEvents } from '../../../api/security'
import { messageFor } from '../../../api/errors'
import type { SecurityEventKind } from '../../../api/types'
import { useUnlockUser } from '../../../api/users'
import { formatDateTime } from '../../lib/format'
import { SECURITY_KINDS } from '../../lib/securityEvents'
import { SecurityEventList } from '../../shared/SecurityEventList'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, Select } from '../../ui/Controls'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const PAGE_SIZE = 25
const KINDS = new Set<SecurityEventKind>(['login', 'device', 'factor', 'account'])
const PERIODS = [
  { value: 1, label: '24 h' },
  { value: 7, label: '7 j' },
  { value: 30, label: '30 j' },
] as const

const parseDays = (value: string | null) => (value === '1' || value === '30' ? Number(value) : 7)
const parseKind = (value: string | null): SecurityEventKind | undefined => (value && KINDS.has(value as SecurityEventKind) ? (value as SecurityEventKind) : undefined)

/** F100: the last security events, easy to find when a resident cannot sign in. */
export default function SecurityEventsPage() {
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(PAGE_SIZE)
  const days = parseDays(params.get('periode'))
  const kind = parseKind(params.get('type'))
  const list = useSecurityEvents({ days, limit, kind })
  const unlock = useUnlockUser()
  const data = list.data

  const update = (changes: Record<string, string | null>) => {
    setLimit(PAGE_SIZE)
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Événements de sécurité"
        lead="Ce qui s’est passé sur les connexions et la protection des comptes. Quand un habitant appelle parce qu’il ne peut plus entrer, le déblocage est ici."
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Connexions refusées (24 h)" value={data?.summary.refused_24h ?? null} icon="lock" tone="alert" />
        <StatTile label="Comptes verrouillés" value={data?.locked_accounts.length ?? null} icon="key" tone="alert" />
        <StatTile label="Nouveaux appareils (24 h)" value={data?.summary.new_devices_24h ?? null} icon="eye" tone="progress" />
        <StatTile label="Changements de protection (7 j)" value={data?.summary.factor_changes_7d ?? null} icon="shield" tone="ice" />
      </motion.div>

      <Panel kicker="F37 · Maintenant" title="Comptes verrouillés" accent={data?.locked_accounts.length ? 'alert' : undefined}>
        {!data ? (
          list.isError ? <EmptyState title={messageFor(list.error)} icon="alert" /> : <Skeleton lines={3} />
        ) : data.locked_accounts.length === 0 ? (
          <EmptyState title="Aucun compte verrouillé" icon="check" />
        ) : (
          <ul className={layout.stack} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.locked_accounts.map((account) => (
              <li key={account.email} className={layout.row} style={{ justifyContent: 'space-between' }}>
                <span>
                  <strong>{account.user ? `${account.user.name} ${account.user.last_name}` : account.email}</strong>
                  <span className={[layout.muted, layout.small].join(' ')} style={{ display: 'block' }}>
                    {account.email}
                    {account.locked_until ? ` · jusqu’à ${formatDateTime(account.locked_until)}` : ''}
                    {!account.user && ' · aucun compte à ce nom (attaque probable)'}
                  </span>
                </span>
                {account.user && (
                  <Button
                    size="sm"
                    icon="unlock"
                    disabled={unlock.isPending}
                    onClick={() =>
                      unlock.mutate(account.user!.id, {
                        onSuccess: () => toast(`${account.email} débloqué`),
                        onError: (error) => toast(messageFor(error), 'alert'),
                      })
                    }
                  >
                    Débloquer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel kicker="F100 · Journal" title="Derniers événements" actions={<LiveDot />} aria-busy={list.isFetching}>
        <div className={layout.row}>
          <FilterChips<number>
            label="Période"
            value={days}
            onChange={(value) => update({ periode: value === 7 ? null : String(value) })}
            options={PERIODS.map((period) => ({ value: period.value, label: period.label }))}
          />
          <Select aria-label="Type" value={kind ?? ''} onChange={(e) => update({ type: e.target.value || null })}>
            {SECURITY_KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        {!data ? (
          list.isError ? <EmptyState title={messageFor(list.error)} icon="alert" /> : <Skeleton lines={6} />
        ) : (
          <>
            <SecurityEventList events={data.data} />
            {data.data.length === limit && limit < 100 && (
              <Button variant="ghost" onClick={() => setLimit((current) => Math.min(100, current + PAGE_SIZE))}>
                Afficher plus
              </Button>
            )}
          </>
        )}
      </Panel>
    </motion.div>
  )
}
