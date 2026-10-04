import type { Announcement, Broadcast } from './types'
import { daysAgo, hoursAgo, minutesAgo } from './time'

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1, title: 'La plateforme numérique de Terra Nova est ouverte',
    summary: 'Créez votre compte pour vos démarches, signalements et suivis.',
    content: 'Le Haut Conseil inaugure la plateforme numérique centrale de la ville…',
    category: 'NEWS', status: 'PUBLISHED', is_important: true, is_pinned: true, author_id: 1, published_at: daysAgo(2), created_at: daysAgo(3),
  },
  {
    id: 2, title: 'Nouveaux horaires du centre de santé', summary: 'Consultations de 7h à 20h.',
    content: 'À partir de cette semaine, le centre de santé élargit ses horaires…',
    category: 'SERVICE_CHANGE', status: 'PUBLISHED', is_important: false, is_pinned: false, author_id: 2, published_at: daysAgo(1), created_at: daysAgo(1),
  },
  {
    id: 3, title: 'Collecte des encombrants : mode d’emploi', summary: null,
    content: 'Faites votre demande en ligne depuis le service Propreté urbaine…',
    category: 'PRACTICAL_INFO', status: 'PUBLISHED', is_important: false, is_pinned: false, author_id: 3, published_at: hoursAgo(20), created_at: hoursAgo(22),
  },
  {
    id: 4, title: 'Fête des Dômes : programme du week-end', summary: 'Concerts, marché et observation des étoiles.',
    content: 'La ville célèbre sa première année…', category: 'EVENT', status: 'DRAFT', is_important: false, is_pinned: false,
    author_id: 2, published_at: null, created_at: hoursAgo(2),
  },
  {
    id: 5, title: 'Coupure d’eau programmée au Quartier Est', summary: 'Mardi de 9h à 12h.',
    content: 'Des travaux sur le réseau nécessitent une coupure…', category: 'SERVICE_CHANGE', status: 'DRAFT', is_important: true, is_pinned: false,
    author_id: 3, published_at: null, created_at: minutesAgo(40),
  },
  {
    id: 6, title: 'Bienvenue aux premiers habitants', summary: null, content: 'Archive de la semaine d’ouverture.',
    category: 'NEWS', status: 'ARCHIVED', is_important: false, is_pinned: false, author_id: 1, published_at: daysAgo(14), created_at: daysAgo(14),
  },
]


export const BROADCASTS: Broadcast[] = [
  { id: 1, title: 'Annonce importante : ouverture de la plateforme', body: 'Créez votre compte dès aujourd’hui.', audience: 'ALL', district_ids: [], recipients: 1240, read_rate: 0.72, sent_at: daysAgo(2), author_id: 1 },
  { id: 2, title: 'Montée des eaux dans le Quartier Sud', body: 'Évitez les berges et les sous-sols.', audience: 'DISTRICTS', district_ids: [3], recipients: 214, read_rate: 0.91, sent_at: hoursAgo(2), author_id: 2 },
  { id: 3, title: 'Vague de chaleur : recommandations', body: 'Restez au frais et hydratez-vous.', audience: 'VULNERABLE', district_ids: [1, 2], recipients: 87, read_rate: 0.64, sent_at: hoursAgo(5), author_id: 1 },
  { id: 4, title: 'Point équipe : nouvelle file des signalements', body: 'Merci de traiter les urgences en priorité.', audience: 'STAFF', district_ids: [], recipients: 5, read_rate: 1, sent_at: hoursAgo(8), author_id: 1 },
]
