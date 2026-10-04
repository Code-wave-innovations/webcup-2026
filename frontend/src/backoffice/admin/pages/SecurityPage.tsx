import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { messageFor } from '../../../api/errors'
import { useClientIp, useLoginAttempts, useNewDevices, useSecurityOverview } from '../../../api/security'
import type { LoginAttempt } from '../../../api/types'
import { useUnlockUser } from '../../../api/users'
import { RadialGauge } from '../../charts/RadialGauge'
import { formatDateTime, formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput } from '../../ui/Controls'
import { DataTable, type Column } from '../../ui/DataTable'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const REASON_LABEL: Record<string, string> = {
  OK: 'Connexion réussie',
  PASSKEY: 'Clé d’accès',
  INVALID_CREDENTIALS: 'Identifiants ou code faux',
  LOCKED: 'Refusée : compte verrouillé',
  IP_BLOCKED: 'Refusée : IP bloquée',
  DISABLED: 'Refusée : compte désactivé',
  UNLOCKED_BY_STAFF: 'Débloqué par le personnel',
}

type Outcome = 'toutes' | 'echecs' | 'reussites'

/** F37 / F53 / F54 / D02: sign-in attacks, locked accounts, new devices and adoption of the second factor. */
export default function SecurityPage() {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const email = params.get('email') ?? ''
  const ip = params.get('ip') ?? ''
  const outcome = (params.get('resultat') as Outcome | null) ?? 'toutes'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const overview = useSecurityOverview()
  const devices = useNewDevices(24)
  const clientIp = useClientIp()
  const unlock = useUnlockUser()
  const attempts = useLoginAttempts({
    email: email || undefined,
    ip: ip || undefined,
    success: outcome === 'toutes' ? undefined : outcome === 'reussites',
    page,
    limit: 20,
  })
  const data = overview.data

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

  const columns: Column<LoginAttempt>[] = [
    { key: 'when', header: 'Quand', cell: (a) => <span title={formatDateTime(a.created_at)}>{formatRelative(a.created_at, now)}</span>, sortValue: (a) => -new Date(a.created_at).getTime() },
    { key: 'email', header: 'E-mail', cell: (a) => <button type="button" className={layout.linkButton} onClick={() => update({ email: a.email })}>{a.email}</button> },
    { key: 'ip', header: 'IP', hideOnPhone: true, cell: (a) => <button type="button" className={layout.linkButton} onClick={() => update({ ip: a.ip })}>{a.ip}</button> },
    {
      key: 'result',
      header: 'Résultat',
      cell: (a) => <Tag tone={a.success ? 'ok' : a.reason === 'INVALID_CREDENTIALS' ? 'progress' : 'alert'}>{REASON_LABEL[a.reason] ?? a.reason}</Tag>,
    },
    { key: 'agent', header: 'Navigateur', hideOnPhone: true, cell: (a) => <span className={[layout.muted, layout.small].join(' ')}>{a.user_agent?.slice(0, 60) ?? '—'}</span> },
  ]

  const ipLooksWrong = clientIp.data && (clientIp.data.ip === null || (clientIp.data.x_forwarded_for !== null && !clientIp.data.trust_proxy))

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Sécurité des connexions"
        lead="Tentatives inhabituelles, comptes bloqués, nouveaux appareils et adoption de la double vérification. Un compte est bloqué 15 min après 5 échecs ; une IP après 20."
        actions={
          <Link to="/admin/parametres#securite" className={layout.linkButton}>
            Politique de double vérification
          </Link>
        }
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Échecs (1 h)" value={data?.last_hour.failed ?? null} icon="alert" tone="progress" hint={data ? `${data.last_hour.succeeded} réussites` : undefined} />
        <StatTile label="Échecs (24 h)" value={data?.last_24h.failed ?? null} icon="clock" tone="ember" />
        <StatTile label="Connexions refusées (24 h)" value={data?.last_24h.blocked ?? null} icon="lock" tone="alert" hint="compte verrouillé ou IP bloquée" />
        <StatTile label="Comptes verrouillés" value={data?.locked_accounts.length ?? null} icon="key" tone="alert" />
      </motion.div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="F37 · Maintenant" title="Comptes verrouillés" accent={data?.locked_accounts.length ? 'alert' : undefined}>
          {!data ? (
            overview.isError ? <EmptyState title={messageFor(overview.error)} icon="alert" /> : <Skeleton lines={3} />
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
                          onSuccess: () => {
                            toast(`${account.email} débloqué`)
                            void overview.refetch()
                          },
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
          {data && data.top_ips.length > 0 && (
            <>
              <p className={layout.sectionLabel}>IP les plus actives (échecs sur 24 h)</p>
              <ul className={layout.row} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.top_ips.slice(0, 6).map((row) => (
                  <li key={row.ip}>
                    <button type="button" className={layout.linkButton} onClick={() => update({ ip: row.ip })}>
                      {row.ip} ({row.failures})
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel kicker="F53 · D02" title="Double vérification du personnel">
          {data ? (
            <>
              <RadialGauge value={data.two_factor.staff_enabled} max={data.two_factor.staff_total} label="personnel protégé" tone={data.two_factor.staff_enabled === data.two_factor.staff_total ? 'ice' : 'ember'} />
              <p className={layout.small}>
                {data.two_factor.staff_enabled} sur {data.two_factor.staff_total} agents et admins ont activé la double vérification · {data.two_factor.citizens_enabled} habitant
                {data.two_factor.citizens_enabled > 1 ? 's' : ''} · {data.two_factor.passkey_users} compte{data.two_factor.passkey_users > 1 ? 's' : ''} avec une clé d’accès.
              </p>
            </>
          ) : (
            <Skeleton lines={4} />
          )}
        </Panel>
      </div>

      <Panel kicker="F54 · 24 dernières heures" title="Nouveaux appareils">
        {!devices.data ? (
          <Skeleton lines={3} />
        ) : devices.data.length === 0 ? (
          <EmptyState title="Aucune connexion depuis un nouvel appareil" icon="check" />
        ) : (
          <ul className={layout.stack} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {devices.data.map((device) => (
              <li key={device.id} className={layout.row}>
                <strong>{device.label}</strong>
                <Link to={`/admin/utilisateurs?role=${device.user.role === 'CITIZEN' ? '' : device.user.role}&compte=${device.user.id}`.replace('role=&', '')}>
                  {device.user.name} {device.user.last_name}
                </Link>
                <span className={[layout.muted, layout.small].join(' ')}>
                  {formatRelative(device.first_seen, now)}
                  {device.last_ip ? ` · IP ${device.last_ip}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel flush kicker="F37 · Journal" title={attempts.data ? `${attempts.data.meta.total} tentative${attempts.data.meta.total > 1 ? 's' : ''}` : 'Tentatives de connexion'} aria-busy={attempts.isFetching}>
        <div className={layout.toolbar}>
          <SearchInput label="E-mail exact" value={email} onChange={(e) => update({ email: e.target.value || null })} />
          <SearchInput label="IP exacte" value={ip} onChange={(e) => update({ ip: e.target.value || null })} />
          <FilterChips<Outcome>
            label="Résultat"
            value={outcome}
            onChange={(value) => update({ resultat: value === 'toutes' ? null : value })}
            options={[
              { value: 'toutes', label: 'Toutes' },
              { value: 'echecs', label: 'Échecs' },
              { value: 'reussites', label: 'Réussites' },
            ]}
          />
        </div>
        {attempts.data ? (
          <DataTable caption="Tentatives de connexion" columns={columns} rows={attempts.data.data} rowKey={(a) => a.id} empty="Aucune tentative ne correspond." />
        ) : attempts.isError ? (
          <EmptyState title={messageFor(attempts.error)} icon="alert" />
        ) : (
          <Skeleton lines={6} />
        )}
        {attempts.data && attempts.data.meta.pages > 1 && (
          <nav className={layout.toolbar} aria-label="Pages">
            <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
              Précédente
            </Button>
            <span aria-current="page">
              Page {attempts.data.meta.page} sur {attempts.data.meta.pages}
            </span>
            <Button size="sm" disabled={page >= attempts.data.meta.pages} onClick={() => update({ page: String(page + 1) }, true)}>
              Suivante
            </Button>
          </nav>
        )}
      </Panel>

      <Panel kicker="Déploiement cPanel" title="Adresse IP vue par le serveur" accent={ipLooksWrong ? 'ember' : undefined}>
        {clientIp.data ? (
          <>
            <dl className={layout.dl}>
              <dt>IP du client</dt>
              <dd>{clientIp.data.ip ?? 'inconnue'}</dd>
              <dt>X-Forwarded-For</dt>
              <dd>{clientIp.data.x_forwarded_for ?? '—'}</dd>
              <dt>TRUST_PROXY</dt>
              <dd>{clientIp.data.trust_proxy ? 'activé' : 'désactivé'}</dd>
            </dl>
            <p className={layout.small}>
              {ipLooksWrong
                ? 'Le serveur ne voit pas votre vraie adresse : sur cPanel, ajoutez TRUST_PROXY=1 aux variables de l’application puis redémarrez-la. Sans IP connue, seuls les blocages par compte s’appliquent.'
                : 'Le serveur voit bien l’adresse des visiteurs : les blocages par IP fonctionnent.'}
            </p>
          </>
        ) : (
          <Skeleton lines={3} />
        )}
      </Panel>
    </motion.div>
  )
}
