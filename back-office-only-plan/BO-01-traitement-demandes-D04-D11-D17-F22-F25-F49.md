# BO-01 : traitement des demandes et signalements

> **Rôle :** Agent (traitement) et Admin (supervision).
> **Réfs :** D04 · D11 · D17 · F22 · F25 · F49. **XP :** 2 180.
> **Dépend de :**
> - BO-00 ;
> - BO-04, pour la liste du personnel (`GET /api/users/staff`) ;
> - BO-03 étape 1 (recommandé), pour que chaque action soit auditée dès le branchement.
>
> **Pendant citoyen :** PLAN-03 de `project-plan/`.
> **Effort :** ≈ 5 h.

## 1. Pourquoi ces réfs vont ensemble

Ces six demandes passent toutes par la **file des demandes de l'agent**, c'est-à-dire la table `CitizenRequest` et ses `RequestEvent`. Le même agent les traite, dans les mêmes écrans.

| Réf | Demandeur | Besoin | Ce que le back-office doit montrer |
|---|---|---|---|
| D04 | Service des Relations Citoyennes | Joindre l'administration, avec une confirmation d'envoi | Les messages `CONTACT`, avec ou sans compte, arrivent dans la file avec le nom et l'e-mail de contact. L'agent sait comment répondre. |
| D11 | Pauline R., citoyenne | Retrouver l'état et les étapes de ses démarches | Chaque action de l'agent produit une étape. L'agent voit ce qui est visible par l'habitant et ce qui est interne. |
| D17 | Service Relation Usagers | Savoir combien de demandes attendent une prise en charge | Le compteur `awaiting_pickup`, dans le menu, sur le tableau de bord et en tête de la file |
| F22 | Centre technique | Une vue claire, l'état de chaque demande, celles qui demandent une action | Une liste filtrable par état, la puce « Nécessite une action » et l'ancienneté visible |
| F25 | Lucas Meyer, citoyen | Signaler un problème : ce qui s'est passé et où | La page Signalements : par quartier, avec photo et localisation, et une prise en charge rapide |
| F49 | Citoyenne | Être prévenue quand sa demande change d'état | Au changement d'état, l'agent voit le message qui partira, puis la trace « Habitant prévenu » |

**Voisins :**
- Le soutien d'une demande (F52) est traité dans le BO-10. Ici, on affiche seulement la colonne « Soutiens ».
- Côté agents, F32 se traduit par la puce « Nécessite une action » et la recherche ⌘K.

## 2. Écrans et état actuel

| Écran | Route | Rôle | Aujourd'hui |
|---|---|---|---|
| `AgentDashboardPage`, encarts « File prioritaire », « Radar » et tuiles | `/agent` | Agent | `requestStore`, `appointmentStore`, `mocks/stats` |
| `RequestsPage` | `/agent/demandes` | Agent | `requestStore` et `setPriority` |
| `RequestDetailPage` | `/agent/demandes/:id` et `/admin/demandes/:id` | Agent et Admin | `changeStatus`, `assignRequest`, `setPriority`, `addComment` |
| `ReportsPage` | `/agent/signalements` | Agent | `requestStore`, `assignRequest`, `mocks/people` |
| `RequestsSupervisionPage` | `/admin/demandes` | Admin | `requestStore`, `assignRequest`, `mocks/stats` |
| Composants partagés | — | — | `shared/RequestTable`, `RequestTimeline`, `CitizenCard`, `DistrictMap`, typés par `mocks/types` |
| Badge `awaiting` et palette ⌘K | Menu | Les deux | `requestStore` |

**Backend déjà prêt :**
- `GET /api/requests` accepte `scope=open|needs_action|closed`, `status`, `type`, `priority`, `service_id`, `district_id`, `assigned=me|none|<id>`, `q`, `sort` et la pagination.
- `GET /api/requests/:id` renvoie les événements, internes compris pour le personnel.
- `PATCH /api/requests/:id` accepte `status`, `priority`, `assigned_agent_id`, `service_id`, `district_id`, `category`, `note` et `internal_note`.
- `POST /api/requests/:id/comments { message, is_internal }`.
- `GET /api/dashboard/stats` renvoie :
  - `requests` : `awaiting_pickup`, `needs_action`, `open`, `unassigned_open`, `assigned_to_me`, `oldest_awaiting`, `by_status`, `open_by_type`, `open_by_priority` ;
  - `queue` ;
  - `platform`.
- **F49 :** un changement de statut, ou une note publique, envoie déjà une notification `REQUEST_UPDATE` à l'habitant qui a un compte (`citizenRequest.controller.ts`, après `citizenRequestModel.update`).

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| Demandes d'un citoyen, pour le détail et la fiche citoyen | Filtre `citizen_id` sur `GET /api/requests`, réservé au personnel |
| Charge par agent, retards, carte des signalements | Ajouter à `GET /api/dashboard/stats` : `open_by_agent` (regroupé par `assigned_agent_id`), `overdue` (ouvertes depuis plus de 3 jours, seuil en constante) et `incidents_by_district` (signalements ouverts par quartier) |
| F49 : un passage à « En attente de l'habitant » sans explication laisse l'habitant sans savoir quoi faire | `PATCH` refuse `status: WAITING_CITIZEN`, `REJECTED` ou `RESOLVED` sans `note` publique : `400`, avec l'erreur sur le champ `note` |
| F49 : savoir si l'habitant a été prévenu | La réponse du `PATCH` ajoute `citizen_notified: boolean`. La règle est déterministe : vrai si la demande a un `citizen_id` et que le changement est public. Aucune colonne n'est ajoutée. |
| Urgence proposée par l'habitant (PLAN-03) | Affichée depuis `data.urgency_hint`. Seul l'agent fixe `priority`. |
| Réassignation groupée (facultatif) | `POST /api/requests/bulk { ids, assigned_agent_id?, priority? }`, réservé au personnel, avec un `RequestEvent` et une entrée d'audit par demande |

## 4. Branchement écran par écran

Fichier front : `src/api/requests.ts` pour `useRequests`, `useRequest`, `useUpdateRequest`, `useAddComment` et `useBulkUpdate`. Fichier `src/api/dashboard.ts` pour `useDashboardStats`.

### 4.1 `RequestsPage` (F22, D04)

**Lecture :** `GET /api/requests?scope=&status=&type=&priority=&assigned=&q=&sort=&page=`. Les filtres sont gardés dans l'URL.

**Puces d'état :**
- « Nécessite une action » (`scope=needs_action`), avec son compteur, sélectionnée par défaut ;
- « En attente de prise en charge » (`status=SUBMITTED`, D17) ;
- « À moi » (`assigned=me`) ;
- « Non assignées » (`assigned=none`) ;
- « Clôturées » (`scope=closed`).

**Colonnes :**
- référence ;
- objet ;
- type ;
- état ;
- priorité ;
- ancienneté (« il y a 3 j », en ambre au-delà du seuil `overdue`) ;
- agent ;
- soutiens (affichée quand le BO-10 est livré).

**Messages de contact (D04) :** un `CONTACT` sans compte affiche « Visiteur sans compte » et l'e-mail de contact.

**Action en ligne :** `setPriority` → `useUpdateRequest({ id, priority })`.

### 4.2 `RequestDetailPage` (D11, F22, F25, F49)

**Lecture**
- `GET /api/requests/:id` (rafraîchie toutes les 30 s).
- Les autres demandes du même habitant : `GET /api/requests?citizen_id=&limit=5`.
- Ses rendez-vous à venir : `GET /api/appointments?citizen_id=`, quand le BO-08 est livré.

**Actions**

| Fonction simulée | Appel |
|---|---|
| `changeStatus` | `PATCH { status, note, internal_note }` |
| `assignRequest` | `PATCH { assigned_agent_id }`. Liste issue de `GET /api/users/staff` (BO-04), avec la charge de chacun (`open_by_agent`). « Prendre en charge » = `{ assigned_agent_id: moi, status: 'IN_REVIEW' }`. |
| `setPriority` | `PATCH { priority }`. L'urgence proposée par l'habitant est affichée à côté. |
| `addComment` | `POST /:id/comments { message, is_internal }` |

**Rendre visible ce que voit l'habitant (D11)**
- Chaque étape de `RequestTimeline` porte l'étiquette « Visible par l'habitant » ou « Interne ». Une étape interne a un fond hachuré, pas seulement une autre couleur.
- Un bouton « Voir comme l'habitant » masque les étapes internes. C'est l'aperçu exact de la page `/ville/espace/demandes/:id`.

**Avis de changement d'état (F49)**
- Dans le panneau « Faire évoluer la demande », sous le choix du nouvel état, un aperçu affiche la notification qui partira :
  > « Demande NT-261003-4F9A2C : En cours de traitement » — suivie du message saisi.
- Pour « En attente de l'habitant », « Rejetée » et « Résolue », le message est **obligatoire**. Son aide propose une formulation, par exemple : « Dites ce que l'habitant doit faire ou ce qui a été fait. »
- Après l'envoi :
  - si `citizen_notified` est vrai : toast « NT-… → En cours · habitant prévenu », et l'étape porte une icône cloche ;
  - sans compte, pour un contact anonyme (D04) : toast « NT-… → En cours · pas de compte : répondez par e-mail ».

**Répondre à un visiteur sans compte (D04)**
- Le panneau « Contact » propose « Répondre par e-mail » : un lien `mailto:` avec la référence dans l'objet.
- L'agent ajoute ensuite une note interne « Répondu par e-mail ». Le serveur n'envoie pas d'e-mail.

**Signalement (F25)**
- Photo de `attachment`, servie par `imgUrl`.
- `location_label`, quartier et position.
- Le point sur le plan (`data.map_point`) s'affiche quand le PLAN-07 ou le BO-09 est livré.

**Historique des modifications :** onglet ajouté par le BO-03.

### 4.3 `ReportsPage` (F25)

- **Lecture :** `GET /api/requests?type=INCIDENT&scope=open&district_id=&sort=`.
- **Grille des quartiers** (`DistrictMap`) : `incidents_by_district` des statistiques. Cliquer un quartier filtre la liste.
- **Actions :**
  - « Prendre en charge » (voir ci-dessus) ;
  - assignation à un autre agent.

### 4.4 `AgentDashboardPage`, partie demandes (D17, F22)

**Lecture :** `GET /api/dashboard/stats`, toutes les 30 s.

| Élément du design | Champ des statistiques |
|---|---|
| Jauge radar « en attente » | `awaiting_pickup`. L'accent passe en alerte si `queue` contient une demande `URGENT` non assignée. |
| Tuiles | `needs_action`, `assigned_to_me`, `unassigned_open` et `oldest_awaiting` (« la plus ancienne attend depuis 2 j ») |
| File prioritaire | `queue` |

« Prendre en charge » est disponible directement depuis la file.

Les autres encarts relèvent d'autres plans : activité (BO-03), Nova Terra et vue simple (BO-02), rendez-vous du jour (BO-08).

### 4.5 `RequestsSupervisionPage` (admin, D17)

- **Lecture :** `open_by_agent` (charge par agent, en barres), `overdue` (liste des demandes en retard) et `by_status`.
- **Actions :**
  - réassigner une demande ;
  - en groupe, si `POST /bulk` existe : cases à cocher, puis « Assigner à… » ou « Priorité… ».

### 4.6 Menu et palette

- **Badge `awaiting` :** `stats.requests.awaiting_pickup`.
- **Palette ⌘K :** la recherche d'une référence ou d'un objet passe par `GET /api/requests?q=&limit=5` et ouvre le détail.

## 5. Nettoyage

- `stores/requestStore.ts` est supprimé.
- `mocks/requests.ts` est supprimé : le seed de `plan-00` reprend déjà ce scénario.
- `mocks/stats.ts` perd `HANDLING_TIME` ; le BO-02 reprend le reste.
- Les composants partagés `RequestTable`, `RequestTimeline` et `CitizenCard` sont retypés sur `src/api/types.ts`.

## 6. Étapes

- [x] Backend :
  - [x] filtre `citizen_id` ;
  - [x] `open_by_agent`, `overdue` et `incidents_by_district` ;
  - [x] message obligatoire pour les états qui demandent une explication ;
  - [x] `citizen_notified` ;
  - [x] `POST /bulk` (facultatif).
- [x] `src/api/requests.ts`, `src/api/dashboard.ts` et types `CitizenRequest` et `RequestEvent`
- [x] `RequestsPage` : filtres dans l'URL, pagination serveur
- [x] `RequestDetailPage` : actions, aperçu de l'avis (F49), « Voir comme l'habitant », réponse par e-mail (D04)
- [x] `ReportsPage` et grille des quartiers
- [x] Encarts « demandes » du tableau de bord agent
- [x] `RequestsSupervisionPage`
- [x] Badge `awaiting` et recherche ⌘K
- [x] Nettoyage des stores et mocks

**Réalisé (4 octobre 2026) :**
- **Retard :** même règle que le BO-02 (`OVERDUE_HOURS` : 4 h urgente, 24 h haute, 72 h normale, 120 h basse) plutôt qu'un seuil unique de 3 jours, pour que la supervision, la vue simple et l'horloge de la liste disent la même chose (`lib/thresholds.ts` côté front).
- **Liste du personnel :** `GET /api/users/staff` est ajouté ici (morceau du BO-04), ouvert à tout le personnel.
- **Assignation :** l'événement `ASSIGNED` garde le nom de l'agent dans `message`, pour que l'historique reste juste après une réassignation. Les anciens événements affichent « Assignation modifiée ».
- **F49 :** la règle est dans le schéma zod du `PATCH` (`EXPLAINED_STATUSES`) ; l'erreur arrive sur `note` et le front la traduit. Une note interne n'est jamais acceptée comme explication.
- **Fil d'activité :** `GET /api/dashboard/activity` lit les `RequestEvent` du personnel. Il remplace les panneaux « Disponible prochainement » des deux tableaux de bord en attendant le journal d'audit (BO-03).
- **`CitizensPage`** (F34, BO-04) est branchée sur `GET /api/users` et `?citizen_id=`, car elle lisait `requestStore`. Le nombre de rendez-vous (BO-08) et le verrou de connexion (BO-05) n'y sont plus affichés.
- **Supprimés :** `stores/requestStore.ts`, `mocks/requests.ts`. `RequestTable`, `RequestTimeline` et `CitizenCard` sont typés sur `src/api/types.ts` ; `DistrictMap` accepte les quartiers de `GET /api/districts`.
- **Vérifié dans le navigateur** avec des demandes de test supprimées ensuite : les 5 critères ci-dessous passent, ainsi que la recherche ⌘K.

## 7. Critères d'acceptation (scénario de démo)

1. **D17 et F22.**
   - Un habitant envoie un signalement depuis `/ville`.
   - Sous 30 s, le badge « Demandes » de `agent@` augmente de 1.
   - La demande apparaît sous la puce « Nécessite une action », avec son ancienneté.
2. **F25.**
   - Dans « Signalements », le quartier du signalement montre +1.
   - La photo et le lieu s'affichent.
   - « Prendre en charge » passe la demande à « En examen » et l'assigne à l'agent.
3. **F49 et D11.**
   - L'agent passe la demande à « En attente de l'habitant » sans message : le formulaire le refuse, avec l'erreur sur le champ.
   - Avec un message, la demande change d'état et l'étape porte « habitant prévenu ».
   - Côté habitant, la cloche affiche la notification. Le suivi montre l'étape, mais pas la note interne ajoutée juste après.
4. **D04.** Un message de contact envoyé sans compte apparaît avec l'e-mail du visiteur. « Répondre par e-mail » ouvre le client de messagerie, avec la référence dans l'objet.
5. **Supervision.** `admin@` voit la charge de chaque agent et réassigne une demande en retard. L'événement « Assignée » apparaît dans l'historique.

## 8. Version minimale

À faire en premier :
- `RequestsPage` avec la puce « Nécessite une action » ;
- `RequestDetailPage` avec les quatre actions ;
- le compteur D17, dans le badge et sur le tableau de bord ;
- le message obligatoire de F49.

Peut attendre :
- `bulk` ;
- « Voir comme l'habitant » ;
- la grille des quartiers ;
- la page de supervision.

## 9. Points d'attention

- **Notes internes :** une note interne ne déclenche jamais de notification. Le backend le garantit déjà. L'interface le dit sous la case « Note interne ».
- **Lien des notifications :** les notifications pointent vers `/requests/:id`. Le front citoyen doit traduire ce lien en `/ville/espace/demandes/:id` (PLAN-03).
- **Assignation :** un agent peut assigner une demande à un autre agent, car le backend l'autorise. La permission « Assigner » affichée par la matrice des rôles (BO-04) doit dire la même chose.
