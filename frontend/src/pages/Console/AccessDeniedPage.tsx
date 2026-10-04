import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import { ConsolePage } from './ConsolePage'

const messages = defineMessages(
  {
    title: 'Accès réservé',
    lead: 'Cette page est réservée à un autre profil que le vôtre.',
    body: 'Si vous pensez devoir y accéder, contactez la mairie.',
    back: 'Retour à l’accueil',
  },
  {
    title: 'Restricted access',
    lead: 'This page is reserved for a different profile from yours.',
    body: 'If you think you should have access, please contact the city hall.',
    back: 'Back to home',
  },
)

/** D09: shown instead of a page the signed-in profile may not open. */
export function AccessDeniedPage() {
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
