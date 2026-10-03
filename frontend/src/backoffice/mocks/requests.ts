import type { CitizenRequest, RequestEvent, RequestPriority, RequestStatus, RequestType } from './types'
import { minutesAgo } from './time'

let eventId = 1

const ev = (minutes: number, e: Partial<RequestEvent> & Pick<RequestEvent, 'type'>): RequestEvent => ({
  id: eventId++,
  created_at: minutesAgo(minutes),
  author_id: null,
  from_status: null,
  to_status: null,
  message: null,
  is_internal: false,
  ...e,
})

interface Seed {
  id: number
  type: RequestType
  status: RequestStatus
  priority: RequestPriority
  subject: string
  message: string
  citizen_id: number | null
  ageMinutes: number
  service_id?: number
  procedure_title?: string
  assigned?: number
  category?: string
  district_id?: number
  location?: string
  coords?: [number, number]
  contact?: [string, string]
  data?: Record<string, string>
  attachment?: string
  extra?: (created: number) => RequestEvent[]
}

const STATUS_PATH: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS']

function build(seed: Seed): CitizenRequest {
  const created = seed.ageMinutes
  const author = seed.citizen_id
  const events: RequestEvent[] = [ev(created, { type: 'CREATED', to_status: 'SUBMITTED', author_id: author })]
  let last = created
  if (seed.assigned) {
    last = Math.round(created * 0.8)
    events.push(ev(last, { type: 'ASSIGNED', author_id: seed.assigned, is_internal: true }))
  }
  const target = seed.status
  const pathIndex = STATUS_PATH.indexOf(target)
  const steps: RequestStatus[] =
    pathIndex >= 0 ? STATUS_PATH.slice(1, pathIndex + 1) : [...STATUS_PATH.slice(1), target]
  let from: RequestStatus = 'SUBMITTED'
  steps.forEach((to, index) => {
    last = Math.max(1, Math.round(last * (0.7 - index * 0.1)))
    events.push(
      ev(last, {
        type: 'STATUS_CHANGED',
        author_id: seed.assigned ?? 2,
        from_status: from,
        to_status: to,
        message: STATUS_NOTES[to] ?? null,
      }),
    )
    from = to
  })
  if (seed.extra) events.push(...seed.extra(created))
  events.sort((a, b) => a.created_at.localeCompare(b.created_at))
  const final = target === 'RESOLVED' || target === 'REJECTED' || target === 'CLOSED'
  return {
    id: seed.id,
    reference: `NT-${String(261000 + seed.id)}-${(seed.id * 7919).toString(16).toUpperCase().slice(-4).padStart(4, '0')}`,
    type: seed.type,
    status: target,
    priority: seed.priority,
    subject: seed.subject,
    message: seed.message,
    citizen_id: seed.citizen_id,
    contact_name: seed.contact?.[0] ?? null,
    contact_email: seed.contact?.[1] ?? null,
    service_id: seed.service_id ?? null,
    procedure_title: seed.procedure_title ?? null,
    assigned_agent_id: seed.assigned ?? null,
    category: seed.category ?? null,
    district_id: seed.district_id ?? null,
    location_label: seed.location ?? null,
    latitude: seed.coords?.[0] ?? null,
    longitude: seed.coords?.[1] ?? null,
    attachment: seed.attachment ?? null,
    data: seed.data ?? null,
    created_at: minutesAgo(created),
    updated_at: events[events.length - 1].created_at,
    resolved_at: final ? events[events.length - 1].created_at : null,
    events,
  }
}

const STATUS_NOTES: Partial<Record<RequestStatus, string>> = {
  IN_REVIEW: 'Votre demande est en cours d’examen.',
  IN_PROGRESS: 'Une équipe a été mandatée.',
  WAITING_CITIZEN: 'Pouvez-vous nous transmettre une photo ?',
  RESOLVED: 'Intervention terminée, merci pour votre signalement.',
  REJECTED: 'Cette demande ne relève pas des services municipaux.',
  CLOSED: 'Demande clôturée.',
}

const SEEDS: Seed[] = [
  {
    id: 1, type: 'INCIDENT', status: 'SUBMITTED', priority: 'URGENT', subject: 'Eau qui monte dans la rue des Berges',
    message: 'L’eau atteint le bas des portes depuis une heure, plusieurs voisins sont inquiets.',
    citizen_id: 11, ageMinutes: 18, service_id: 9, category: 'inondation', district_id: 3, location: 'Quai des Berges, Quartier Sud', coords: [-21.12, 55.53],
  },
  {
    id: 2, type: 'INCIDENT', status: 'SUBMITTED', priority: 'HIGH', subject: 'Lampadaire cassé',
    message: 'Le lampadaire devant le numéro 12 ne s’allume plus depuis deux jours, la rue est très sombre.',
    citizen_id: 11, ageMinutes: 64, service_id: 7, category: 'éclairage', district_id: 3, location: '12 rue du Réservoir, Quartier Sud', coords: [-21.118, 55.528], attachment: 'lampadaire.jpg',
  },
  {
    id: 3, type: 'PROCEDURE', status: 'IN_PROGRESS', priority: 'NORMAL', subject: 'Demande d’acte de naissance',
    message: 'Je souhaite obtenir une copie intégrale de mon acte de naissance.', citizen_id: 16, ageMinutes: 1460, service_id: 1,
    procedure_title: 'Demander un acte de naissance', assigned: 2, data: { full_name: 'Pauline Ravelo', birth_date: '1994-02-11', copy_type: 'Copie intégrale' },
  },
  {
    id: 4, type: 'CONTACT', status: 'SUBMITTED', priority: 'NORMAL', subject: 'Question sur les horaires de la navette',
    message: 'Bonjour, la navette N3 passe-t-elle le dimanche matin ?', citizen_id: null, ageMinutes: 95,
    contact: ['Visiteur Tahina', 'tahina@mail.nt'], service_id: 5,
  },
  {
    id: 5, type: 'INCIDENT', status: 'IN_REVIEW', priority: 'HIGH', subject: 'Nid de poule dangereux',
    message: 'Un trou profond s’est formé au carrefour, deux scooters ont déjà chuté.', citizen_id: 15, ageMinutes: 320,
    service_id: 7, category: 'voirie', district_id: 4, location: 'Carrefour de l’Énergie, Quartier Est', coords: [-21.1, 55.56], assigned: 3,
  },
  {
    id: 6, type: 'PROCEDURE', status: 'WAITING_CITIZEN', priority: 'NORMAL', subject: 'Inscription nouvel habitant',
    message: 'Je viens d’arriver avec ma famille, nous sommes 4.', citizen_id: 13, ageMinutes: 2900, service_id: 2,
    procedure_title: 'S’inscrire comme nouvel habitant', assigned: 2, data: { arrival_date: '2026-09-28', household_size: '4' },
  },
  {
    id: 7, type: 'INCIDENT', status: 'RESOLVED', priority: 'NORMAL', subject: 'Dépôt sauvage de déchets',
    message: 'Des sacs ont été abandonnés près des serres.', citizen_id: 13, ageMinutes: 4300, service_id: 6, category: 'propreté',
    district_id: 5, location: 'Chemin des Serres, Quartier Ouest', coords: [-21.13, 55.5], assigned: 4,
  },
  {
    id: 8, type: 'CONTACT', status: 'IN_REVIEW', priority: 'LOW', subject: 'Accessibilité du site',
    message: 'Avec mon lecteur d’écran, certains boutons ne sont pas annoncés.', citizen_id: 15, ageMinutes: 760, assigned: 2,
  },
  {
    id: 9, type: 'PROCEDURE', status: 'SUBMITTED', priority: 'NORMAL', subject: 'Rendez-vous médical',
    message: 'Consultation pour un suivi tension.', citizen_id: 12, ageMinutes: 140, service_id: 3,
    procedure_title: 'Prendre rendez-vous au centre de santé', data: { preferred_date: '2026-10-06', reason: 'Suivi tension' },
  },
  {
    id: 10, type: 'INCIDENT', status: 'SUBMITTED', priority: 'NORMAL', subject: 'Fuite d’eau sur le trottoir',
    message: 'Une canalisation fuit devant l’école.', citizen_id: 18, ageMinutes: 230, service_id: 8, category: 'eau',
    district_id: 2, location: 'Allée du Savoir, Quartier Nord', coords: [-21.09, 55.52],
  },
  {
    id: 11, type: 'PROCEDURE', status: 'REJECTED', priority: 'LOW', subject: 'Demande de permis de construire',
    message: 'Extension d’un dôme privé.', citizen_id: 16, ageMinutes: 6200, service_id: 1, procedure_title: 'Demande d’urbanisme', assigned: 3,
  },
  {
    id: 12, type: 'INCIDENT', status: 'IN_PROGRESS', priority: 'URGENT', subject: 'Panne de climatisation au foyer seniors',
    message: 'Il fait plus de 35°C dans la salle commune, des personnes âgées sont présentes.', citizen_id: 14, ageMinutes: 210,
    service_id: 10, category: 'chaleur', district_id: 1, location: 'Foyer des Aînés, Centre-Ville', coords: [-21.11, 55.54], assigned: 2,
    extra: (created) => [ev(Math.round(created * 0.3), { type: 'COMMENT', author_id: 2, message: 'Ventilateurs livrés en attendant le technicien.', is_internal: false })],
  },
  {
    id: 13, type: 'CONTACT', status: 'SUBMITTED', priority: 'NORMAL', subject: 'Changement d’adresse',
    message: 'Comment mettre à jour mon adresse sur la plateforme ?', citizen_id: 20, ageMinutes: 35,
  },
  {
    id: 14, type: 'INCIDENT', status: 'WAITING_CITIZEN', priority: 'NORMAL', subject: 'Arbre penché sur la voie',
    message: 'Un arbre menace de tomber sur la piste cyclable.', citizen_id: 18, ageMinutes: 1700, service_id: 6, category: 'espaces verts',
    district_id: 2, location: 'Piste du Campus, Quartier Nord', coords: [-21.088, 55.515], assigned: 4,
  },
  {
    id: 15, type: 'PROCEDURE', status: 'CLOSED', priority: 'NORMAL', subject: 'Collecte d’encombrants',
    message: 'Un canapé et une armoire.', citizen_id: 12, ageMinutes: 8000, service_id: 6, procedure_title: 'Demander une collecte d’encombrants', assigned: 3,
    data: { items: 'Canapé, armoire' },
  },
  {
    id: 16, type: 'INCIDENT', status: 'SUBMITTED', priority: 'HIGH', subject: 'Feu de signalisation éteint',
    message: 'Le feu du carrefour central ne fonctionne plus.', citizen_id: 16, ageMinutes: 52, service_id: 7, category: 'signalisation',
    district_id: 1, location: 'Place du Conseil, Centre-Ville', coords: [-21.112, 55.538],
  },
  {
    id: 17, type: 'PROCEDURE', status: 'IN_REVIEW', priority: 'NORMAL', subject: 'Abonnement transport senior',
    message: 'Je souhaite bénéficier du tarif senior.', citizen_id: 12, ageMinutes: 600, service_id: 5, procedure_title: 'Abonnement réseau urbain', assigned: 3,
  },
  {
    id: 18, type: 'CONTACT', status: 'RESOLVED', priority: 'LOW', subject: 'Traduction en malgache',
    message: 'Est-il possible d’avoir les démarches en malgache ?', citizen_id: 19, ageMinutes: 5100, assigned: 2,
  },
]

export const REQUESTS: CitizenRequest[] = SEEDS.map(build)
