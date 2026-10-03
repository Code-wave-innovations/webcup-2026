import type { Permission, PlatformSettings, Role, TranslationEntry } from './types'

export const LOCALES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'mg', label: 'Malagasy' },
  { code: 'es', label: 'Español' },
]

export const PERMISSIONS: Permission[] = [
  { key: 'requests.read', label: 'Consulter les demandes', description: 'Voir la file et le détail des demandes citoyennes.', sensitive: false, group: 'Demandes' },
  { key: 'requests.process', label: 'Traiter les demandes', description: 'Changer l’état, la priorité, ajouter des notes.', sensitive: false, group: 'Demandes' },
  { key: 'requests.assign', label: 'Assigner les demandes', description: 'Réattribuer une demande à un autre agent.', sensitive: false, group: 'Demandes' },
  { key: 'requests.delete', label: 'Supprimer une demande', description: 'Suppression définitive, sans retour possible.', sensitive: true, group: 'Demandes' },
  { key: 'citizens.read', label: 'Consulter les citoyens', description: 'Coordonnées et historique nécessaires au traitement.', sensitive: true, group: 'Comptes' },
  { key: 'citizens.manage', label: 'Gérer les comptes citoyens', description: 'Désactiver, déverrouiller, corriger un profil.', sensitive: true, group: 'Comptes' },
  { key: 'staff.manage', label: 'Gérer les agents et admins', description: 'Créer des comptes staff et changer les rôles.', sensitive: true, group: 'Comptes' },
  { key: 'content.publish', label: 'Publier annonces et alertes', description: 'Diffuser une information à tous les habitants.', sensitive: false, group: 'Contenus' },
  { key: 'broadcast.send', label: 'Notifications globales', description: 'Envoyer une notification à toute la population.', sensitive: true, group: 'Contenus' },
  { key: 'catalog.manage', label: 'Gérer le catalogue', description: 'Services, mise en avant, interruptions.', sensitive: false, group: 'Contenus' },
  { key: 'appointments.manage', label: 'Gérer les rendez-vous', description: 'Créneaux, présence, annulations.', sensitive: false, group: 'Rendez-vous' },
  { key: 'audit.read', label: 'Lire le journal d’audit', description: 'Qui a fait quoi, quand et d’où.', sensitive: true, group: 'Traçabilité' },
  { key: 'settings.manage', label: 'Paramètres de la plateforme', description: 'Accueil, langues, sécurité, maintenance.', sensitive: true, group: 'Traçabilité' },
]

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  CITIZEN: [],
  AGENT: ['requests.read', 'requests.process', 'requests.assign', 'citizens.read', 'citizens.manage', 'content.publish', 'catalog.manage', 'appointments.manage'],
  ADMIN: PERMISSIONS.map((p) => p.key),
}

export const SETTINGS: PlatformSettings = {
  home_sections: [
    { key: 'alerts', label: 'Alertes en cours', enabled: true },
    { key: 'services', label: 'Services mis en avant', enabled: true },
    { key: 'disruptions', label: 'Services perturbés et transports', enabled: true },
    { key: 'announcements', label: 'Dernières annonces', enabled: true },
    { key: 'appointment', label: 'Mon prochain rendez-vous', enabled: true },
    { key: 'categories', label: 'Catégories de services', enabled: false },
  ],
  default_locale: 'fr',
  enabled_locales: ['fr', 'en', 'mg'],
  registration_open: true,
  maintenance_mode: false,
  login_max_failures: 5,
  login_lock_minutes: 15,
  reminder_default_minutes: 1440,
}

export const TRANSLATIONS: TranslationEntry[] = [
  {
    entity: 'CityService', entity_id: 1, label: 'État civil',
    fields: { name: 'État civil', summary: 'Actes de naissance, mariage, décès et livret de famille.' },
    translations: { en: { name: 'Civil registry', summary: 'Birth, marriage and death certificates, family records.' }, mg: {} },
  },
  {
    entity: 'CityService', entity_id: 2, label: 'Accueil des nouveaux arrivants',
    fields: { name: 'Accueil des nouveaux arrivants', summary: 'Inscription, logement, premiers pas.' },
    translations: { en: { name: 'Newcomers welcome desk', summary: 'Registration, housing, first steps.' }, mg: { name: 'Fandraisana ireo vao tonga' } },
  },
  {
    entity: 'CityService', entity_id: 3, label: 'Centre de santé',
    fields: { name: 'Centre de santé', summary: 'Consultations, urgences et suivi médical.' },
    translations: { en: { name: 'Health centre', summary: 'Consultations, emergencies and medical follow-up.' }, mg: { name: 'Toeram-pahasalamana', summary: 'Fitsaboana sy vonjy maika.' } },
  },
  {
    entity: 'ServiceCategory', entity_id: 2, label: 'Santé',
    fields: { name: 'Santé' }, translations: { en: { name: 'Health' }, mg: { name: 'Fahasalamana' } },
  },
  {
    entity: 'Procedure', entity_id: 1, label: 'Demander un acte de naissance',
    fields: { title: 'Demander un acte de naissance', description: 'Recevez une copie intégrale ou un extrait.' },
    translations: { en: {}, mg: {} },
  },
  {
    entity: 'Alert', entity_id: 2, label: 'Vague de chaleur extrême',
    fields: { title: 'Vague de chaleur extrême', instructions: 'Restez au frais, hydratez-vous.' },
    translations: { en: { title: 'Extreme heatwave' }, mg: {} },
  },
  {
    entity: 'Announcement', entity_id: 1, label: 'Ouverture de la plateforme',
    fields: { title: 'La plateforme numérique de Terra Nova est ouverte', summary: 'Créez votre compte.' },
    translations: { en: { title: 'Terra Nova’s digital platform is open', summary: 'Create your account.' }, mg: {} },
  },
]
