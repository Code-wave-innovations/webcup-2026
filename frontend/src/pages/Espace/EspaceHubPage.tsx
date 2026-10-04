import { useCitizenUser } from '../../api/session'
import { useRequests } from '../../api/requests'
import { messageFor } from '../../api/errors'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Espace.module.css'

/** D03 / D11: personal hub — entry to Mes demandes. */
export default function EspaceHubPage() {
  const user = useCitizenUser()
  const open = useRequests({ scope: 'open', limit: 1 })
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 })
  const district = user?.district?.name

  return (
    <ConsolePage
      title="Mon espace"
      lead={
        user
          ? `Bonjour ${user.name}${district ? ` · ${district}` : ''}. Retrouvez ici le suivi de vos démarches.`
          : undefined
      }
    >
      <GlassPanel className={styles.card}>
        <h2>Mes demandes</h2>
        {(open.isPending || waiting.isPending) && <p className={text.note}>Chargement…</p>}
        {open.isError && (
          <p className={text.error}>
            {messageFor(open.error)}{' '}
            <button type="button" onClick={() => void open.refetch()}>
              Réessayer
            </button>
          </p>
        )}
        {open.data && waiting.data && (
          <>
            <p>
              {open.data.meta.total} en cours
              {waiting.data.meta.total > 0 ? ` · ${waiting.data.meta.total} à compléter` : ''}
            </p>
            <div className={styles.cardActions}>
              <ButtonRouteLink to="/ville/espace/demandes">Voir mes demandes</ButtonRouteLink>
            </div>
          </>
        )}
      </GlassPanel>
    </ConsolePage>
  )
}
