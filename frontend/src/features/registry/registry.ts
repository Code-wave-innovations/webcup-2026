import { defineMessages } from '../../i18n'

export interface RegistryEntry {
  ref: 'A07' | 'A02' | 'D04'
  /** city flyover section id (`#…`) or in-app path (`/ville/…`) */
  section: string
}

/** Sample lines; the first one is the example of the API documentation. */
export const REGISTRY: readonly RegistryEntry[] = [
  { ref: 'A07', section: 'signaler' },
  { ref: 'A02', section: 'signaler' },
  { ref: 'D04', section: '/ville/contact' },
]

/** D14: each sample line's request and its details, by reference. */
export const registryMessages = defineMessages(
  {
    entries: {
      A07: { request: "Je souhaite pouvoir suivre l'état de ma demande.", meta: 'Habitante, moyenne, 520 XP' },
      A02: { request: 'Je veux signaler un problème dans mon secteur.', meta: 'Habitant, facile, 250 XP' },
      D04: { request: "Joindre l'administration avec une confirmation d'envoi.", meta: 'Relations citoyennes, facile' },
    },
    received: 'reçues',
    delivered: 'livrées',
    inProgress: 'en chantier',
    see: 'Voir',
    quote: (request: string) => `« ${request} »`,
    note: "Lignes d'exemple. La première reprend l'exemple de la documentation de l'API.",
  },
  {
    entries: {
      A07: { request: 'I would like to be able to follow the status of my request.', meta: 'Resident, medium, 520 XP' },
      A02: { request: 'I want to report a problem in my district.', meta: 'Resident, easy, 250 XP' },
      D04: { request: 'Contact the administration with a delivery confirmation.', meta: 'Citizen relations, easy' },
    },
    received: 'received',
    delivered: 'delivered',
    inProgress: 'in progress',
    see: 'View',
    quote: (request) => `“${request}”`,
    note: 'Sample lines. The first one is the example from the API documentation.',
  },
)

export const REGISTRY_COUNTS = { received: 43, delivered: 21, inProgress: 4 } as const
