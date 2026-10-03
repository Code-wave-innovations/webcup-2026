export interface RegistryEntry {
  ref: string
  request: string
  meta: string
  /** section of the city page where the feature lives */
  section: string
}

/** Sample lines; the first one is the example of the API documentation. */
export const REGISTRY: readonly RegistryEntry[] = [
  { ref: 'A07', request: "Je souhaite pouvoir suivre l'état de ma demande.", meta: 'Habitante, moyenne, 520 XP', section: 'signaler' },
  { ref: 'A02', request: 'Je veux signaler un problème dans mon secteur.', meta: 'Habitant, facile, 250 XP', section: 'signaler' },
  { ref: 'A05', request: 'Le Conseil doit pouvoir publier une annonce à toute la ville.', meta: 'Haut Conseil, moyenne, 500 XP', section: 'conseil' },
]

export const REGISTRY_COUNTS = { received: 43, delivered: 21, inProgress: 4 } as const
