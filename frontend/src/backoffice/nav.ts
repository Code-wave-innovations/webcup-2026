import type { IconName } from './ui/Icon'
import type { Persona } from './mocks/types'

export interface NavItem {
  path: string
  label: string
  icon: IconName
  /** Badge counter key, resolved by the shell from the stores. */
  badge?: 'awaiting' | 'appointmentsToday' | 'activeAlerts' | 'interruptions'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const AGENT_NAV: NavGroup[] = [
  {
    label: 'Traitement',
    items: [
      { path: '/agent', label: 'Tableau de bord', icon: 'dashboard' },
      { path: '/agent/demandes', label: 'Demandes', icon: 'inbox', badge: 'awaiting' },
      { path: '/agent/signalements', label: 'Signalements', icon: 'pin' },
      { path: '/agent/rendez-vous', label: 'Rendez-vous', icon: 'calendar', badge: 'appointmentsToday' },
      { path: '/agent/citoyens', label: 'Citoyens', icon: 'users' },
      { path: '/agent/interruptions', label: 'Interruptions', icon: 'wrench', badge: 'interruptions' },
      { path: '/agent/transports', label: 'Transports', icon: 'bus' },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { path: '/agent/activite', label: 'Activité & historique', icon: 'activity' },
      { path: '/agent/nova-terra', label: 'API Nova Terra', icon: 'satellite' },
    ],
  },
]

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Supervision',
    items: [
      { path: '/admin', label: 'Vue globale', icon: 'radar' },
      { path: '/admin/demandes', label: 'Demandes', icon: 'inbox', badge: 'awaiting' },
      { path: '/admin/audit', label: 'Journal d’audit', icon: 'scroll' },
    ],
  },
  {
    label: 'Comptes & droits',
    items: [
      { path: '/admin/utilisateurs', label: 'Utilisateurs', icon: 'users' },
      { path: '/admin/roles', label: 'Rôles & permissions', icon: 'key' },
      { path: '/admin/securite', label: 'Sécurité', icon: 'shield' },
    ],
  },
  {
    label: 'Contenus',
    items: [
      { path: '/admin/services', label: 'Catalogue de services', icon: 'grid' },
      { path: '/admin/maintenance', label: 'Interruptions', icon: 'wrench', badge: 'interruptions' },
      { path: '/admin/transports', label: 'Transports', icon: 'bus' },
      { path: '/admin/annonces', label: 'Annonces', icon: 'megaphone' },
      { path: '/admin/alertes', label: 'Alertes', icon: 'siren', badge: 'activeAlerts' },
      { path: '/admin/notifications', label: 'Notifications', icon: 'bell' },
      { path: '/admin/traductions', label: 'Traductions', icon: 'globe' },
      { path: '/admin/rendez-vous', label: 'Créneaux de RDV', icon: 'calendar' },
    ],
  },
  {
    label: 'Plateforme',
    items: [{ path: '/admin/parametres', label: 'Paramètres', icon: 'settings' }],
  },
]

export const NAV: Record<Persona, NavGroup[]> = { AGENT: AGENT_NAV, ADMIN: ADMIN_NAV }

export const flatNav = (persona: Persona) => NAV[persona].flatMap((g) => g.items)
