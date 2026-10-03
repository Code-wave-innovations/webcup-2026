import type { User } from '../mocks/types'
import { formatDateTime, formatRelative } from '../lib/format'
import { districtName } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import { LOCALES } from '../mocks/config'
import { Flag, Tag } from '../ui/Badges'
import { Avatar } from '../ui/Feedback'
import layout from '../ui/layout.module.css'

/** F34: the citizen information an agent needs to process a request — nothing more. */
export function CitizenCard({ citizen, requests, appointments }: { citizen: User; requests?: number; appointments?: number }) {
  const now = useNow()
  return (
    <div className={layout.stack}>
      <div className={layout.row}>
        <Avatar name={citizen.name} lastName={citizen.last_name} size={44} tone={citizen.is_active ? 'ice' : 'neutral'} />
        <div>
          <p className={layout.strong}>
            {citizen.name} {citizen.last_name}
          </p>
          <p className={[layout.muted, layout.small].join(' ')}>{citizen.email}</p>
        </div>
      </div>
      <div className={layout.row}>
        {!citizen.is_active && <Tag tone="alert">Compte désactivé</Tag>}
        {citizen.login_locked && <Flag icon="lock" tone="alert">Connexion verrouillée</Flag>}
        {citizen.is_vulnerable && <Flag icon="alert" tone="progress">Personne vulnérable</Flag>}
        {!citizen.onboarding_completed && <Tag tone="ember">Profil incomplet</Tag>}
      </div>
      <dl className={layout.dl}>
        <dt>Téléphone</dt>
        <dd>{citizen.phone ?? '—'}</dd>
        <dt>Adresse</dt>
        <dd>{citizen.address ?? '—'}</dd>
        <dt>Quartier</dt>
        <dd>{districtName(citizen.district_id)}</dd>
        <dt>Langue</dt>
        <dd>{LOCALES.find((l) => l.code === citizen.locale)?.label ?? citizen.locale}</dd>
        <dt>Inscrit·e</dt>
        <dd>{formatDateTime(citizen.created_at)}</dd>
        <dt>Dernière connexion</dt>
        <dd>{citizen.last_login_at ? formatRelative(citizen.last_login_at, now) : 'Jamais'}</dd>
        {requests !== undefined && (
          <>
            <dt>Demandes</dt>
            <dd>{requests}</dd>
          </>
        )}
        {appointments !== undefined && (
          <>
            <dt>Rendez-vous</dt>
            <dd>{appointments}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
