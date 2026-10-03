# PLAN-10 : espace agents, API Nova Terra et traçabilité

> **Réfs :** D19 · F47 · F48 · **XP :** 2 350
> **Dépend de :** PLAN-00 et PLAN-01. L'étape 1 (audit côté serveur) se fait **juste après le PLAN-01**. Les étapes 2 à 4 viennent après le PLAN-03.
> **Effort :** environ 5 h (étape 1 : 1,5 h ; étapes 2 à 4 : 3,5 h)

## 1. Pourquoi ces trois demandes vont ensemble

D19 demande aux agents un espace de travail distinct de celui des citoyens. Cet espace doit montrer les informations de l'API Nova Terra et permettre de **suivre l'activité de la plateforme** dès sa mise en service.

F47 et F48 demandent que chaque action soit **tracée et consultable dans le temps**. Dans cet espace de travail, on doit savoir facilement **qui a modifié quoi**.

Le journal d'audit sert donc aux deux : c'est lui qui alimente le suivi d'activité demandé par D19.

| Réf | Demandeur | Besoin | Ce qui prouve que c'est fait |
|---|---|---|---|
| D19 | Direction du Numérique | Espace agents distinct, affichant l'API Nova Terra et l'activité de la plateforme | Tableau de bord et flux Nova Terra réels, accessibles uniquement au personnel |
| F47 | Autorité de Contrôle | Justifier les actions : opérations traçables et consultables dans le temps | Journal d'audit immuable, filtrable et exportable |
| F48 | Service Qualité | Savoir qui a modifié quoi dans l'administration | Historique avant/après dans chaque fiche |

## 2. Existant

**Backend**
- Le proxy `GET /api/terra-nova/requests` est en place : réservé au personnel, cache de 60 s, `?refresh=true` pour forcer la mise à jour, clé `TERRA_NOVA_API_KEY` envoyée dans l'en-tête `X-Webcup-Api-Key`.
- `RequestEvent` trace les demandes : statut, assignation, priorité, commentaires.
- `LoginAttempt` trace les connexions.
- **Il n'existe aucun journal d'audit général.**

**Back-office**
- Pages simulées : tableau de bord agent, `ActivityPage`, `AuditPage` (filtres, avant/après, export CSV), `AdminOverviewPage`, `NovaTerraPage`.
- `auditStore.recordAudit()` est appelé depuis le navigateur par toutes les actions simulées.
- `startLiveAudit()` simule l'arrivée d'actions en direct.
- Le type `AuditLog` de `mocks/types.ts` décrit la forme cible des entrées.

**Front citoyen**
`RegistryPanel` (registre des demandes Terra Nova destiné au jury) affiche des données écrites en dur : 3 lignes d'exemple et des compteurs fixes.

## 3. Backend

### 3.1 Journal d'audit (F47, F48) — étape 1

```prisma
// F47 / F48: who did what, when, on which record (before -> after)
model AuditLog {
  id           Int      @id @default(autoincrement())
  created_at   DateTime @default(now())
  actor_id     Int?               // null = système (planificateur, cron)
  actor_role   Role?
  actor_name   String?            // figé au moment de l'action (survit à la suppression du compte)
  action       String   @db.VarChar(64)  // request.status_changed, service.updated, user.unlocked…
  entity       String   @db.VarChar(64)  // CitizenRequest, CityService, User…
  entity_id    Int?
  entity_label String?            // NT-261003-4F9A2C, « État civil »…
  changes      Json?              // [{ field, from, to }]
  metadata     Json?
  ip           String?  @db.VarChar(64)

  @@index([entity, entity_id])
  @@index([actor_id, created_at])
  @@index([action])
  @@index([created_at])
}
```

**Fonction d'écriture**

Le fichier `src/lib/audit.ts` expose `audit(req, { action, entity, entityId, label, before, after, fields, metadata })`. Elle :
- calcule les différences sur les seuls champs listés dans `fields` ;
- n'enregistre jamais de secret, comme `password_hash` ou les tokens ;
- relève l'IP avec `clientIp()`, qui la laisse vide quand elle est inconnue (cas de cPanel) ;
- ne fait jamais échouer l'action métier : une erreur d'écriture du journal est seulement consignée.

**Où appeler `audit()`**

On l'ajoute dans toutes les mutations faites par le personnel :

| Domaine | Actions auditées |
|---|---|
| Comptes | `user.created`, `user.updated` (profil, rôle, activation), `user.deleted`, `user.login_unlocked` |
| Catalogue | `service.*`, `category.*`, `procedure.*` |
| Demandes | `request.status_changed`, `request.assigned`, `request.priority_changed`, `request.internal_note`, `request.bulk_updated` |
| Information | `announcement.created`, `announcement.updated`, `announcement.published`, `announcement.archived`, `announcement.deleted` ; `alert.created`, `alert.updated`, `alert.closed` ; `broadcast.sent` |
| Services | `interruption.created`, `interruption.updated`, `interruption.ended`, `interruption.deleted` |
| Transports | `transit.line_status`, `transit.stops`, `transit.timetable` |
| Rendez-vous | `slot.*`, `appointment.status`, `appointment.notes` |
| Plateforme | `settings.updated`, `place.*` (PLAN-07), `glossary.*` (PLAN-09), `delivery.updated` |

Une action citoyenne est aussi tracée : `user.self_deleted` (F33), sans donnée personnelle dans l'entrée.

**Règles**
- Le journal est **immuable** : aucune route de modification ni de suppression, aucune purge automatique.
- Le seed crée quelques entrées d'historique, pour que les écrans ne soient pas vides au premier lancement.

**Endpoints**

| Endpoint | Accès | Rôle |
|---|---|---|
| `GET /api/audit-logs?actor_id=&entity=&entity_id=&action=&from=&to=&q=&page=` | personnel | Agents : tout, sauf les entrées `security.*` et les IP. Admins : tout. |
| `GET /api/audit-logs/export.csv` | admin | Mêmes filtres que la liste, export CSV en UTF-8 avec BOM. |
| `GET /api/audit-logs/stats?days=14` | admin | Nombre d'actions par jour et par acteur, pour la vue globale. |

### 3.2 Suivi d'activité (D19)

`GET /api/dashboard/trends?days=14` (personnel) renvoie :
- les demandes créées et résolues par jour, par type ;
- le délai médian de prise en charge ;
- une grille jour × heure des créations, pour la carte de chaleur de la vue globale.

### 3.3 Registre Terra Nova (D19, bonus pour le jury)

**Modèle**

```prisma
enum DeliveryStatus {
  PLANNED
  IN_PROGRESS
  DELIVERED
}

// D19: which Terra Nova request is delivered by which feature of the platform
model FeatureDelivery {
  request_code  String         @id @db.VarChar(16)
  status        DeliveryStatus @default(PLANNED)
  plan          String?        // PLAN-03…
  link          String?        // route of the app (/ville/espace/demandes, /agent…)
  note          String?        @db.Text
  delivered_at  DateTime?
  updated_at    DateTime       @updatedAt
  updated_by_id Int?
}
```

**Endpoints**

| Endpoint | Accès | Rôle |
|---|---|---|
| `PUT /api/terra-nova/deliveries/:code` | personnel, audité | Mettre à jour le statut de livraison d'une demande. |
| `GET /api/terra-nova/registry` | public | Fusionne le flux mis en cache (code, demandeur, message, difficulté, XP, vague) avec le statut de livraison et le lien. La clé de l'API n'est jamais exposée. Si le flux est indisponible, renvoie les livraisons seules. |

**Seed** : chaque code reçoit le plan qui le couvre, selon la matrice de `project-plan/README.md`. Le statut évolue au fil des livraisons.

## 4. Back-office

### 4.1 Pages et données

| Page | Lecture | Actions |
|---|---|---|
| `AgentDashboardPage`, encarts « Activité récente » et « Nova Terra » (D19) | `GET /api/audit-logs?limit=8` (toutes les 15 s) et `GET /api/terra-nova/requests` | Aucune. Les chiffres D17 viennent du PLAN-03. |
| `ActivityPage` (F47, F48) | Onglet « Mes actions » (`actor_id=moi`) et onglet « Équipe ». Filtres : objet, action, période. | Aucune. |
| `AuditPage`, admin (F47, F48) | `GET /api/audit-logs`, filtres repris dans l'URL. Affiche l'avant/après et l'IP. | Export : téléchargement de `export.csv` en blob. |
| `AdminOverviewPage` (D19, F47) | `dashboard/stats`, `dashboard/trends`, `audit-logs/stats`, alertes et interruptions actives | Aucune. |
| `NovaTerraPage` (D19) | `GET /api/terra-nova/requests` (toutes les 60 s) | « Actualiser » (`?refresh=true`). Statut de livraison : `PUT /deliveries/:code`, avec le plan et le lien. |
| **Historique des modifications** (F48) : tiroirs Services, Utilisateurs, Annonces, Alertes, Lieux, Lexique et `RequestDetailPage` | `GET /api/audit-logs?entity=&entity_id=` | Aucune. |

### 4.2 Détail de la `NovaTerraPage`

- La vague en cours.
- Un compte à rebours jusqu'à la vague suivante, calculé à partir de `minutes_until_next_wave` et recalé sur `fetched_at`.
- Les cartes des demandes, avec leur statut de livraison.
- Des filtres par groupe, difficulté et statut.
- Un toast « Nouvelle vague : N demandes » quand `visible_requests_count` augmente.

### 4.3 Affichage d'une entrée

Une entrée se lit en une ligne :

> « Ada R. · il y a 3 min · Service « Prévention santé » · priorité : 2 → 5 »

Les valeurs internes sont traduites en français grâce à `lib/labels.ts` (`auditValue`).

### 4.4 Ce qu'on garde et ce qu'on supprime

- On garde `AuditFeed` pour l'affichage : les nouvelles entrées s'y signalent par un flash.
- On supprime `auditStore`, `startLiveAudit`, `recordAudit` et `mocks/audit.ts`, ainsi que les appels à `recordAudit` dans tous les stores restants.

### 4.5 Erreurs du flux Nova Terra

Si la clé est absente (`503`) ou si l'API ne répond pas (`502`), la page affiche :

> « Flux Nova Terra indisponible : dernière mise à jour à … »

Les dernières données du cache restent affichées.

## 5. Front citoyen

`RegistryPanel` utilise `GET /api/terra-nova/registry` :
- il affiche les vrais compteurs : demandes reçues, livrées, en chantier ;
- il affiche les dernières demandes livrées, avec la citation de leur demandeur ;
- le bouton « Voir » mène à la fonctionnalité correspondante (route ou section du survol). C'est ce qui permet au jury de vérifier chaque demande en un clic.

On retire la mention « Lignes d'exemple ».

## 6. Étapes

1. [x] **Juste après le PLAN-01** : `AuditLog`, `lib/audit.ts`, appels dans les contrôleurs existants, `GET /api/audit-logs`
2. [x] `src/api/audit.ts` : `ActivityPage`, `AuditPage` (export compris), historiques dans les tiroirs, suppression de l'audit côté navigateur
3. [ ] `dashboard/trends`, `audit-logs/stats` et `AdminOverviewPage` ; encarts du tableau de bord agent
4. [ ] `src/api/terraNova.ts` et `NovaTerraPage` : flux réel, compte à rebours, nouvelle vague
5. [ ] `FeatureDelivery`, `/registry`, seed des livraisons ; `RegistryPanel` côté citoyen

## 7. Critères d'acceptation

1. **D19**
   - L'agent se connecte et arrive dans un espace distinct de celui des citoyens.
   - Le flux Nova Terra affiche la vague en cours, les demandes et le compte à rebours.
   - L'activité de la plateforme (demandes, actions) est visible dès la première demande.
2. **F47**
   - Chaque action sensible (changement d'état, publication d'une alerte, déblocage d'un compte, mise en avant d'un service…) crée une entrée. Elle indique l'auteur, la date, l'objet, l'avant/après et, pour les admins, l'IP.
   - Le journal se filtre par personne, objet et période, et s'exporte en CSV.
   - Aucune entrée ne peut être modifiée : il n'existe aucune route pour cela.
3. **F48** — Dans la fiche d'un service ou d'une demande, on lit : « Modifié par Ada R. il y a 3 min — priorité : 2 → 5 ».
4. **Bonus** — Le registre de la page citoyenne affiche les vrais compteurs et mène à chaque fonctionnalité livrée.

## 8. Version minimale

- L'étape 1 : journal serveur et lecture.
- `AuditPage` et `ActivityPage`.
- L'historique dans `RequestDetailPage` et dans le tiroir Services.
- `NovaTerraPage` branchée.

Le registre public, les tendances et l'export CSV peuvent attendre.

## 9. Points d'attention

- **Données personnelles** : un `changes` ne doit jamais contenir de mot de passe ni le contenu complet d'un message de citoyen. Pour les messages, on enregistre seulement leur longueur ou un extrait.
- **Volume** : une entrée par action reste raisonnable. Les index sont prévus pour la page Audit, et l'export est paginé côté serveur si besoin.
- **Clé Terra Nova** : elle reste dans `backend/.env` (non versionné) et n'est jamais renvoyée au front, ni par `/registry` ni par les erreurs.
