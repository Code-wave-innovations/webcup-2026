import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import { ConsolePage } from './ConsolePage'

/** Unknown address under /ville. */
export function NotFoundPage() {
  return (
    <ConsolePage title="Page introuvable" lead="Cette adresse ne correspond à aucune page de la plateforme. Elle a peut-être changé.">
      <GlassPanel>
        <p>Revenez à l’accueil de la ville pour retrouver les services, vos demandes et les annonces.</p>
        <div>
          <ButtonRouteLink to="/ville">Retour à l’accueil</ButtonRouteLink>
        </div>
      </GlassPanel>
    </ConsolePage>
  )
}
