import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import { ConsolePage } from './ConsolePage'

/** D09: shown instead of a page the signed-in profile may not open. */
export function AccessDeniedPage() {
  return (
    <ConsolePage title="Accès réservé" lead="Cette page est réservée à un autre profil que le vôtre.">
      <GlassPanel>
        <p>Si vous pensez devoir y accéder, contactez la mairie.</p>
        <div>
          <ButtonRouteLink to="/ville">Retour à l’accueil</ButtonRouteLink>
        </div>
      </GlassPanel>
    </ConsolePage>
  )
}
