import type { Alert, Announcement, Broadcast } from './types'
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

export const ALERTS: Alert[] = [
  {
    id: 1, title: 'Montée des eaux dans le Quartier Sud', message: 'Une montée inhabituelle du niveau de l’eau est observée dans le Quartier Sud.',
    category: 'FLOOD', severity: 'CRITICAL', audience: 'DISTRICTS', district_ids: [3],
    instructions: 'Évitez les berges et les sous-sols, montez dans les étages et suivez les consignes des secours.',
    recommendations: [], source: 'Centre de surveillance environnementale', starts_at: hoursAgo(2), ends_at: null, is_active: true, notified: 214,
  },
  {
    id: 2, title: 'Vague de chaleur extrême', message: 'Une vague de chaleur extrême touche plusieurs secteurs de la ville.',
    category: 'HEATWAVE', severity: 'WARNING', audience: 'VULNERABLE', district_ids: [1, 2],
    instructions: 'Restez au frais, hydratez-vous et prenez des nouvelles de vos proches isolés.',
    recommendations: ['Personnes âgées : buvez de l’eau toutes les heures.', 'Enfants : évitez les sorties entre 12h et 16h.', 'Malades chroniques : contactez le centre de santé au moindre malaise.'],
    source: 'Agence sanitaire de Terra Nova', starts_at: hoursAgo(5), ends_at: null, is_active: true, notified: 87,
  },
  {
    id: 3, title: 'Réunion publique du Haut Conseil', message: 'Réunion ouverte à tous ce soir à 19h, place du Conseil.',
    category: 'GENERAL', severity: 'INFO', audience: 'ALL', district_ids: [], instructions: null, recommendations: [],
    source: 'Haut Conseil de la Ville', starts_at: daysAgo(1), ends_at: hoursAgo(10), is_active: false, notified: 1240,
  },
]

export const BROADCASTS: Broadcast[] = [
  { id: 1, title: 'Annonce importante : ouverture de la plateforme', body: 'Créez votre compte dès aujourd’hui.', audience: 'ALL', district_ids: [], recipients: 1240, read_rate: 0.72, sent_at: daysAgo(2), author_id: 1 },
  { id: 2, title: 'Montée des eaux dans le Quartier Sud', body: 'Évitez les berges et les sous-sols.', audience: 'DISTRICTS', district_ids: [3], recipients: 214, read_rate: 0.91, sent_at: hoursAgo(2), author_id: 2 },
  { id: 3, title: 'Vague de chaleur : recommandations', body: 'Restez au frais et hydratez-vous.', audience: 'VULNERABLE', district_ids: [1, 2], recipients: 87, read_rate: 0.64, sent_at: hoursAgo(5), author_id: 1 },
  { id: 4, title: 'Point équipe : nouvelle file des signalements', body: 'Merci de traiter les urgences en priorité.', audience: 'STAFF', district_ids: [], recipients: 5, read_rate: 1, sent_at: hoursAgo(8), author_id: 1 },
]
