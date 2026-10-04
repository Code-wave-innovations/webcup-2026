import type { Role } from "@prisma/client";

/*
  D08 / D09: who can do what, as the server applies it. This matrix DESCRIBES the guards
  (requireStaff, requireAdmin in the routers) and the rules of the controllers; it changes nothing.
  `npm run check:permissions` fails when a guarded route is missing here or its guard differs.
*/

export type RouteGuard = "authenticated" | "staff" | "admin";

export interface PermissionRoute {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  guard: RouteGuard;
}

export interface Permission {
  key: string;
  label: string;
  description: string;
  group: string;
  sensitive: boolean;
  roles: Role[];
  /** what the controller restricts further, beyond the route guard */
  rule?: string;
  routes: PermissionRoute[];
}

const r = (method: PermissionRoute["method"], path: string, guard: RouteGuard): PermissionRoute => ({ method, path, guard });
const STAFF: Role[] = ["AGENT", "ADMIN"];
const ADMIN: Role[] = ["ADMIN"];

export const PERMISSIONS: Permission[] = [
  {
    key: "dashboard.read",
    label: "Tableaux de bord et flux Nova Terra",
    description: "Compteurs, tendances, vue simple, API Nova Terra.",
    group: "Pilotage",
    sensitive: false,
    roles: STAFF,
    routes: [
      r("GET", "/api/dashboard/stats", "staff"),
      r("GET", "/api/dashboard/trends", "staff"),
      r("GET", "/api/dashboard/summary", "staff"),
      r("GET", "/api/terra-nova/requests", "staff"),
    ],
  },
  {
    key: "requests.process",
    label: "Traiter et assigner les demandes",
    description: "Changer l’état, la priorité, l’agent ; notes internes ; actions groupées.",
    group: "Demandes",
    sensitive: false,
    roles: STAFF,
    rule: "Un citoyen ne voit que ses propres demandes ; celle d’un autre renvoie 404.",
    routes: [r("PATCH", "/api/requests/:id", "staff"), r("POST", "/api/requests/bulk", "staff"), r("GET", "/api/users/staff", "staff")],
  },
  {
    key: "requests.delete",
    label: "Supprimer une demande",
    description: "Suppression définitive, sans retour possible.",
    group: "Demandes",
    sensitive: true,
    roles: ADMIN,
    routes: [r("DELETE", "/api/requests/:id", "admin")],
  },
  {
    key: "citizens.manage",
    label: "Gérer les comptes citoyens",
    description: "Consulter, corriger un profil, débloquer, désactiver avec un motif, supprimer.",
    group: "Comptes",
    sensitive: true,
    roles: STAFF,
    rule: "Un agent n’atteint que les comptes CITIZEN (sinon 404) et ne peut changer ni l’e-mail, ni le mot de passe, ni le rôle (403).",
    routes: [
      r("GET", "/api/users", "staff"),
      r("GET", "/api/users/:id", "staff"),
      r("PATCH", "/api/users/:id", "staff"),
      r("POST", "/api/users/:id/unlock-login", "staff"),
      r("DELETE", "/api/users/:id", "staff"),
    ],
  },
  {
    key: "staff.manage",
    label: "Gérer le personnel et les rôles",
    description: "Créer un compte agent ou admin, changer un rôle, compter les comptes.",
    group: "Comptes",
    sensitive: true,
    roles: ADMIN,
    rule: "Un admin ne peut ni se retirer son rôle, ni se désactiver, ni se supprimer.",
    routes: [r("POST", "/api/users", "admin"), r("GET", "/api/users/stats", "admin")],
  },
  {
    key: "content.publish",
    label: "Publier annonces et alertes",
    description: "Créer, modifier, publier et clôturer annonces et alertes.",
    group: "Information",
    sensitive: false,
    roles: STAFF,
    routes: [
      r("POST", "/api/announcements", "staff"),
      r("PATCH", "/api/announcements/:id", "staff"),
      r("POST", "/api/announcements/:id/publish", "staff"),
      r("DELETE", "/api/announcements/:id", "staff"),
      r("GET", "/api/alerts", "staff"),
      r("POST", "/api/alerts", "staff"),
      r("PATCH", "/api/alerts/:id", "staff"),
      r("POST", "/api/alerts/:id/close", "staff"),
    ],
  },
  {
    key: "alerts.delete",
    label: "Supprimer une alerte",
    description: "Retirer une alerte de l’historique.",
    group: "Information",
    sensitive: true,
    roles: ADMIN,
    routes: [r("DELETE", "/api/alerts/:id", "admin")],
  },
  {
    key: "interruptions.manage",
    label: "Déclarer une interruption de service",
    description: "Maintenance ou incident : créer, modifier, terminer, supprimer.",
    group: "Services",
    sensitive: false,
    roles: STAFF,
    routes: [
      r("POST", "/api/service-interruptions", "staff"),
      r("PATCH", "/api/service-interruptions/:id", "staff"),
      r("POST", "/api/service-interruptions/:id/end", "staff"),
      r("DELETE", "/api/service-interruptions/:id", "staff"),
      r("GET", "/api/services/:id/impact", "staff"),
    ],
  },
  {
    key: "service.cut",
    label: "Couper ou rétablir un service",
    description: "Couper immédiatement un service défectueux (il reste visible comme « Indisponible ») et le rétablir.",
    group: "Services",
    sensitive: true,
    roles: ADMIN,
    rule: "Les habitants qui ont un rendez-vous sur la période sont prévenus ; l’action est auditée.",
    routes: [r("POST", "/api/services/:id/disable", "admin"), r("POST", "/api/services/:id/enable", "admin")],
  },
  {
    key: "catalog.manage",
    label: "Gérer le catalogue",
    description: "Services, catégories, démarches et quartiers.",
    group: "Services",
    sensitive: false,
    roles: ADMIN,
    routes: [
      r("POST", "/api/services", "admin"),
      r("PATCH", "/api/services/:id", "admin"),
      r("DELETE", "/api/services/:id", "admin"),
      r("POST", "/api/service-categories", "admin"),
      r("PATCH", "/api/service-categories/:id", "admin"),
      r("DELETE", "/api/service-categories/:id", "admin"),
      r("POST", "/api/procedures", "admin"),
      r("PATCH", "/api/procedures/:id", "admin"),
      r("DELETE", "/api/procedures/:id", "admin"),
      r("POST", "/api/districts", "admin"),
      r("PATCH", "/api/districts/:id", "admin"),
      r("DELETE", "/api/districts/:id", "admin"),
    ],
  },
  {
    key: "appointments.manage",
    label: "Gérer les rendez-vous",
    description: "Créneaux, présence, notes d’agent.",
    group: "Rendez-vous",
    sensitive: false,
    roles: STAFF,
    routes: [
      r("POST", "/api/appointments/slots", "staff"),
      r("POST", "/api/appointments/slots/bulk", "staff"),
      r("PATCH", "/api/appointments/slots/:id", "staff"),
      r("DELETE", "/api/appointments/slots/:id", "staff"),
      r("PATCH", "/api/appointments/:id", "staff"),
    ],
  },
  {
    key: "reminders.run",
    label: "Lancer les rappels",
    description: "Envoyer tout de suite les rappels de rendez-vous dus.",
    group: "Rendez-vous",
    sensitive: false,
    roles: ADMIN,
    routes: [r("POST", "/api/appointments/reminders/run", "admin")],
  },
  {
    key: "transit.manage",
    label: "Gérer les transports",
    description: "Lignes, arrêts, horaires et état du trafic.",
    group: "Référentiels",
    sensitive: false,
    roles: STAFF,
    routes: [
      r("POST", "/api/transit/lines", "staff"),
      r("PATCH", "/api/transit/lines/:id", "staff"),
      r("PATCH", "/api/transit/lines/:id/status", "staff"),
      r("PUT", "/api/transit/lines/:id/stops", "staff"),
      r("PUT", "/api/transit/lines/:id/timetable", "staff"),
      r("DELETE", "/api/transit/lines/:id", "staff"),
      r("POST", "/api/transit/stops", "staff"),
      r("PATCH", "/api/transit/stops/:id", "staff"),
      r("DELETE", "/api/transit/stops/:id", "staff"),
    ],
  },
  {
    key: "translations.manage",
    label: "Gérer les traductions",
    description: "Contenus traduits des services et démarches.",
    group: "Référentiels",
    sensitive: false,
    roles: ADMIN,
    routes: [
      r("GET", "/api/translations/schema", "admin"),
      r("GET", "/api/translations", "admin"),
      r("PUT", "/api/translations", "admin"),
      r("DELETE", "/api/translations/:id", "admin"),
    ],
  },
  {
    key: "audit.read",
    label: "Lire le journal d’audit",
    description: "Qui a fait quoi, quand, sur quoi.",
    group: "Traçabilité",
    sensitive: true,
    roles: STAFF,
    rule: "Un agent ne voit ni les entrées de sécurité, ni les adresses IP.",
    routes: [r("GET", "/api/audit-logs", "staff")],
  },
  {
    key: "audit.export",
    label: "Exporter le journal d’audit",
    description: "Export CSV et statistiques du journal ; l’export est lui-même audité.",
    group: "Traçabilité",
    sensitive: true,
    roles: ADMIN,
    routes: [r("GET", "/api/audit-logs/export.csv", "admin"), r("GET", "/api/audit-logs/stats", "admin")],
  },
  {
    key: "security.read",
    label: "Surveiller les connexions",
    description: "Tentatives, comptes verrouillés, IP suspectes.",
    group: "Sécurité",
    sensitive: true,
    roles: ADMIN,
    routes: [
      r("GET", "/api/security/overview", "admin"),
      r("GET", "/api/security/login-attempts", "admin"),
      r("GET", "/api/security/client-ip", "admin"),
      r("GET", "/api/security/new-devices", "admin"),
    ],
  },
  {
    key: "security.manage",
    label: "Agir sur la sécurité d’un compte",
    description: "Déconnecter tous les appareils, réinitialiser la double vérification, révoquer les clés d’accès.",
    group: "Sécurité",
    sensitive: true,
    roles: ADMIN,
    rule: "Chaque action est auditée ; la personne est prévenue d’une réinitialisation.",
    routes: [
      r("GET", "/api/users/:id/security", "admin"),
      r("GET", "/api/users/:id/devices", "admin"),
      r("POST", "/api/users/:id/revoke-sessions", "admin"),
      r("POST", "/api/users/:id/2fa/reset", "admin"),
      r("DELETE", "/api/users/:id/passkeys", "admin"),
    ],
  },
  {
    key: "settings.manage",
    label: "Paramètres de la plateforme",
    description: "Accueil, inscriptions, maintenance, politique de sécurité.",
    group: "Plateforme",
    sensitive: true,
    roles: ADMIN,
    routes: [r("GET", "/api/settings", "admin"), r("PATCH", "/api/settings", "admin")],
  },
  {
    key: "permissions.read",
    label: "Consulter la matrice des droits",
    description: "Ce tableau.",
    group: "Plateforme",
    sensitive: false,
    roles: STAFF,
    routes: [r("GET", "/api/permissions", "staff")],
  },
];
