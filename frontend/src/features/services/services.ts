import type { Tone } from '../../ui/Badges'

export interface CityService {
  name: string
  detail: string
  state: string
  tone: Tone
}

/** Sample services; the real list will come from the API's requests. */
export const SERVICES: readonly CityService[] = [
  { name: 'Clinique du dôme 1', detail: 'Attente estimée : 10 min', state: 'Ouverte', tone: 'ok' },
  { name: 'Logement', detail: 'Attribution et échange', state: 'Ouvert', tone: 'ok' },
  { name: 'Eau et énergie', detail: 'Relevés et quotas du foyer', state: 'Ouvert', tone: 'ok' },
  { name: 'Transports', detail: 'Anneau nord : reprise à 20:00', state: 'Perturbé', tone: 'progress' },
  { name: 'État civil', detail: 'Actes et attestations', state: 'Sur rendez-vous', tone: 'taken' },
]
