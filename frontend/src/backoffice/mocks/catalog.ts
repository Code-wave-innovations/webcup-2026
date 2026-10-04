import type { CityService, ServiceCategory } from './types'

export const CATEGORIES: ServiceCategory[] = [
  { id: 1, slug: 'administration', name: 'Administration & état civil' },
  { id: 2, slug: 'sante', name: 'Santé' },
  { id: 3, slug: 'mobilite', name: 'Mobilité & transports' },
  { id: 4, slug: 'environnement', name: 'Environnement & propreté' },
  { id: 5, slug: 'urbanisme', name: 'Urbanisme, voirie & éclairage' },
  { id: 6, slug: 'securite', name: 'Sécurité & prévention' },
  { id: 7, slug: 'solidarite', name: 'Solidarité & famille' },
]

const service = (s: Omit<CityService, 'contact_phone' | 'address'> & Partial<CityService>): CityService => ({
  contact_phone: null,
  address: null,
  ...s,
})

export const SERVICES: CityService[] = [
  service({ id: 1, slug: 'etat-civil', category_id: 1, name: 'État civil', summary: 'Actes de naissance, mariage, décès et livret de famille.', icon: 'file', is_featured: true, priority: 10, view_count: 1284, is_active: true, address: 'Hôtel de ville' }),
  service({ id: 2, slug: 'accueil-nouveaux-arrivants', category_id: 1, name: 'Accueil des nouveaux arrivants', summary: 'Inscription, logement, premiers pas.', icon: 'door', is_featured: true, priority: 9, view_count: 986, is_active: true }),
  service({ id: 3, slug: 'centre-de-sante', category_id: 2, name: 'Centre de santé', summary: 'Consultations, urgences et suivi médical.', icon: 'heart', is_featured: true, priority: 10, view_count: 2140, is_active: true, contact_phone: '+00 100 115' }),
  service({ id: 4, slug: 'prevention-sante', category_id: 2, name: 'Prévention santé & vaccination', summary: 'Campagnes, dépistage, risques climatiques.', icon: 'shield', is_featured: false, priority: 5, view_count: 412, is_active: true }),
  service({ id: 5, slug: 'transports-urbains', category_id: 3, name: 'Réseau de transport urbain', summary: 'Navettes, lignes et abonnements.', icon: 'bus', is_featured: true, priority: 7, view_count: 1530, is_active: true }),
  service({ id: 6, slug: 'proprete-dechets', category_id: 4, name: 'Propreté urbaine & déchets', summary: 'Collecte, recyclage et encombrants.', icon: 'trash', is_featured: false, priority: 6, view_count: 640, is_active: true }),
  service({ id: 7, slug: 'eclairage-voirie', category_id: 5, name: 'Éclairage public & voirie', summary: 'Lampadaires, routes, trottoirs.', icon: 'bulb', is_featured: false, priority: 6, view_count: 702, is_active: true }),
  service({ id: 8, slug: 'eau-energie', category_id: 4, name: 'Eau & énergie', summary: 'Distribution d’eau et réseau énergétique.', icon: 'drop', is_featured: false, priority: 4, view_count: 388, is_active: true }),
  service({ id: 9, slug: 'securite-civile', category_id: 6, name: 'Sécurité civile', summary: 'Risques, alertes et consignes d’urgence.', icon: 'siren', is_featured: false, priority: 8, view_count: 455, is_active: true }),
  service({ id: 10, slug: 'action-sociale', category_id: 7, name: 'Action sociale', summary: 'Familles, seniors et personnes vulnérables.', icon: 'hand', is_featured: false, priority: 5, view_count: 301, is_active: true }),
  service({ id: 11, slug: 'urbanisme', category_id: 5, name: 'Urbanisme & permis', summary: 'Permis de construire et autorisations.', icon: 'building', is_featured: false, priority: 2, view_count: 120, is_active: false }),
]

