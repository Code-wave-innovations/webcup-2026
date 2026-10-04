import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import { ConsolePage } from './ConsolePage'

const messages = defineMessages(
  {
    title: 'Page introuvable',
    lead: 'Cette adresse ne correspond à aucune page de la plateforme. Elle a peut-être changé.',
    body: 'Revenez à l’accueil de la ville pour retrouver les services, vos demandes et les annonces.',
    back: 'Retour à l’accueil',
  },
  {
    title: 'Page not found',
    lead: 'This address does not match any page of the platform. It may have changed.',
    body: 'Head back to the city’s home page to find the services, your requests and the announcements.',
    back: 'Back to home',
  },
)

/** Unknown address under /ville. */
export function NotFoundPage() {
  const m = useMessages(messages)
  return (
    <ConsolePage title={m.title} lead={m.lead}>
      <GlassPanel>
        <p>{m.body}</p>
        <div>
          <ButtonRouteLink to="/ville">{m.back}</ButtonRouteLink>
        </div>
      </GlassPanel>
    </ConsolePage>
  )
}
