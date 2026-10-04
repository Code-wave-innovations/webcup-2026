import type { IconName } from './ui/Icon'
import type { Persona } from './mocks/types'

export interface NavItem {
  path: string
  label: string
  icon: IconName
  /** Terra Nova request codes covered by the screen. */
  codes: string[]
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
      { path: '/agent', label: 'Tableau de bord', icon: 'dashboard', codes: ['D19', 'F22', 'D17'] },
      { path: '/agent/demandes', label: 'Demandes', icon: 'inbox', codes: ['F22', 'D11'], badge: 'awaiting' },
      { path: '/agent/signalements', label: 'Signalements', icon: 'pin', codes: ['F25'] },
      { path: '/agent/rendez-vous', label: 'Rendez-vous', icon: 'calendar', codes: ['F39'], badge: 'appointmentsToday' },
      { path: '/agent/citoyens', label: 'Citoyens', icon: 'users', codes: ['F34'] },
      { path: '/agent/interruptions', label: 'Interruptions', icon: 'wrench', codes: ['F38'], badge: 'interruptions' },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { path: '/agent/activite', label: 'Activité & historique', icon: 'activity', codes: ['F47', 'F48'] },
      { path: '/agent/nova-terra', label: 'API Nova Terra', icon: 'satellite', codes: ['D19'] },
    ],
  },
]

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Supervision',
    items: [
      { path: '/admin', label: 'Vue globale', icon: 'radar', codes: ['D19', 'F47'] },
      { path: '/admin/demandes', label: 'Demandes', icon: 'inbox', codes: ['D17', 'F34'], badge: 'awaiting' },
      { path: '/admin/audit', label: 'Journal d’audit', icon: 'scroll', codes: ['F47', 'F48'] },
    ],
  },
  {
    label: 'Comptes & droits',
    items: [
      { path: '/admin/utilisateurs', label: 'Utilisateurs', icon: 'users', codes: ['F34', 'D08'] },
      { path: '/admin/roles', label: 'Rôles & permissions', icon: 'key', codes: ['D08', 'D09'] },
      { path: '/admin/securite', label: 'Sécurité', icon: 'shield', codes: ['F37', 'F53', 'F54', 'D02'] },
    ],
  },
  {
    label: 'Contenus',
    items: [
      { path: '/admin/services', label: 'Catalogue de services', icon: 'grid', codes: ['D05', 'F28', 'F63', 'F64'] },
      { path: '/admin/maintenance', label: 'Interruptions', icon: 'wrench', codes: ['F38', 'F64'], badge: 'interruptions' },
      { path: '/admin/annonces', label: 'Annonces', icon: 'megaphone', codes: ['D06', 'D18'] },
      { path: '/admin/alertes', label: 'Alertes', icon: 'siren', codes: ['D18', 'F29', 'F31'], badge: 'activeAlerts' },
      { path: '/admin/notifications', label: 'Notifications', icon: 'bell', codes: ['F30'] },
      { path: '/admin/traductions', label: 'Traductions', icon: 'globe', codes: ['D14', 'F27'] },
      { path: '/admin/rendez-vous', label: 'Créneaux de RDV', icon: 'calendar', codes: ['F39'] },
    ],
  },
  {
    label: 'Plateforme',
    items: [{ path: '/admin/parametres', label: 'Paramètres', icon: 'settings', codes: ['D07', 'D08'] }],
  },
]

export const NAV: Record<Persona, NavGroup[]> = { AGENT: AGENT_NAV, ADMIN: ADMIN_NAV }

export const flatNav = (persona: Persona) => NAV[persona].flatMap((g) => g.items)
