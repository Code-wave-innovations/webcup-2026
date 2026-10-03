# PLAN-03 : demandes citoyennes (contact, démarches, signalements et suivi)

> **Réfs :** D04 · D11 · D16 · D17 · F22 · F25 · F26 — **XP :** 2 390
> **Dépend de :** PLAN-00 et PLAN-01. PLAN-02 n'est utile que pour lancer une démarche depuis la fiche d'un service.
> **Débloque :** PLAN-09 (première démarche guidée) et PLAN-10 (tableau de bord et historique)
> **Effort :** environ 6 h

## 1. Pourquoi ces demandes vont ensemble

Le backend range tout dans une seule table, `CitizenRequest`, avec trois types (`CONTACT`, `PROCEDURE`, `INCIDENT`) et une table de suivi, `RequestEvent`.

Côté habitant :
- il peut écrire à la mairie (D04), signaler un problème (F25) ou faire une démarche en ligne ;
- il reçoit une confirmation immédiate (D16) ;
- il suit l'état de sa demande et les étapes déjà franchies (D11) ;
- il retrouve son historique (F26).

Côté agent :
- il voit les demandes et repère celles qui attendent une action (F22) ;
- il connaît en un coup d'œil le nombre de demandes en attente de prise en charge (D17).

Tout changement fait d'un côté doit être visible de l'autre.

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| D04 | Service des Relations Citoyennes | Envoyer un message aux services municipaux, avec confirmation | Formulaire de contact accessible avec ou sans compte |
| D16 | Citoyenne | Savoir tout de suite que la demande est bien reçue | Écran de confirmation avec la référence et la suite, sans doublon |
| F25 | Lucas Meyer | Signaler un problème en disant ce qui s'est passé et où | Signalement avec quartier, lieu, photo facultative et position |
| D11 | Pauline R. | Retrouver ses demandes, leur état et les étapes déjà faites | « Mes demandes » avec une frise d'étapes datées |
| F26 | Citoyenne | Retrouver toutes ses demandes passées | Historique des demandes clôturées, avec recherche |
| F22 | Centre technique municipal | Repérer l'état des demandes et celles qui attendent une action | Liste des agents filtrable, avec un filtre « Nécessite une action » |
| D17 | Service Relation Usagers | Savoir immédiatement combien de demandes attendent une prise en charge | Compteur visible sur chaque écran du back-office et sur le tableau de bord |

## 2. Existant

**Backend, prêt :**
- `POST /api/requests` :
  - `CONTACT` est ouvert à tous ; sans compte, il faut fournir `contact_name` et `contact_email`.
  - `PROCEDURE` exige `procedure_id` et `data`, dont les champs obligatoires sont vérifiés.
  - `INCIDENT` exige `location_label`, ou `latitude` et `longitude`. Il accepte `category`, `district_id` et une pièce jointe `attachment`.
  - La réponse contient la `reference` (par exemple `NT-261003-4F9A2C`) et un `message`. Le citoyen connecté reçoit aussi une notification.
- `GET /api/requests` accepte `scope` (`open`, `needs_action`, `closed`), `status`, `type`, `priority`, `service_id`, `district_id`, `assigned` (`me`, `none` ou un id), `q`, `sort` et la pagination. Un citoyen ne voit que ses demandes.
- `GET /api/requests/:id` renvoie aussi les événements. Les événements internes sont masqués pour le citoyen, et la demande d'un autre citoyen renvoie 404.
- `POST /api/requests/:id/comments { message, is_internal }`
- Pour le personnel, `PATCH /api/requests/:id` accepte `status`, `priority`, `assigned_agent_id`, `service_id`, `district_id`, `category`, `note` et `internal_note`. Le citoyen est notifié des changements de statut et des messages.
- `GET /api/dashboard/stats` renvoie `awaiting_pickup` (D17), `needs_action`, `open`, `unassigned_open`, `assigned_to_me`, `oldest_awaiting`, `by_status`, `open_by_type`, `open_by_priority`, la file `queue` et `platform`.

**Front citoyen :**
- `features/reports/ReportForm.tsx` propose catégorie, secteur et urgence à partir de mots-clés (`analyzeReport`). Les secteurs sont fictifs et écrits en dur (Dôme 1 à 4, Serre 1, Anneau nord).
- La référence est fixe (`TN-0416`) et le suivi avance avec un bouton de démonstration.
- Le faisceau 3D au-dessus du dôme 3 est piloté par `directorStore.setSignalStatus`.

**Back-office :** `AgentDashboardPage`, `RequestsPage`, `RequestDetailPage`, `ReportsPage` et `RequestsSupervisionPage` sont simulées par `requestStore`.

## 3. Ce qui manque au backend

| Manque | Correctif |
|---|---|
| Filtrer les demandes d'un citoyen, pour la fiche citoyen (F34, PLAN-01) | Ajouter `citizen_id` à `listQuerySchema`, réservé au personnel |
| Charge par agent, retards et répartition des signalements | Ajouter à `GET /api/dashboard/stats` : `open_by_agent` (regroupement par `assigned_agent_id`), `overdue` (demandes ouvertes depuis plus de 3 jours, avec le seuil en constante) et `incidents_by_district` (signalements ouverts par quartier) |
| Liste du personnel pour l'assignation | `GET /api/users/staff`, fourni par le PLAN-01 |
| Urgence proposée par l'habitant | Ne pas laisser le citoyen fixer la priorité. L'urgence proposée part dans `data.urgency_hint` (`LOW`, `NORMAL` ou `HIGH`), affichée à l'agent, qui fixe lui-même `priority` |
| Réassignation groupée (facultatif) | `POST /api/requests/bulk { ids, assigned_agent_id?, priority? }` pour le personnel, avec un `RequestEvent` par demande |

## 4. Front citoyen

### 4.1 Écrire à la mairie (D04, D16) : `/ville/contact`, aussi accessible depuis le sas sans compte

- Champs : objet, message, service concerné (facultatif, liste issue de `GET /api/services`).
- Sans compte, ajouter le nom et l'e-mail.
- Afficher à côté les coordonnées de la mairie (`support_contact`, défini au PLAN-00).
- Envoi : `POST /api/requests { type: 'CONTACT', subject, message, service_id? }`

### 4.2 Signaler un problème (F25) : section « Signaler » du survol et page `/ville/signaler`

**Garder l'expérience actuelle :** une phrase suffit, et NOVA propose la catégorie, le quartier et l'urgence.

**Adapter `reportModel.ts` :**
- Les secteurs deviennent les quartiers de l'API (`GET /api/districts`).
- Les catégories reprennent celles que le backend connaît (texte libre côté API) : Éclairage public, Voirie, Propreté et déchets, Eau et énergie, Sécurité, Transports, Autre.
- `analyzeReport` reconnaît aussi les noms de quartiers (« quartier sud », « centre-ville », etc.). Mettre à jour ses tests.

**Ajouter le « où » :**
- Une adresse ou un repère (`location_label`), obligatoire s'il n'y a pas de position.
- Un bouton « Utiliser ma position » (`navigator.geolocation`, qui remplit `latitude` et `longitude`), avec une explication si la permission est refusée.
- En option, le choix du point sur le plan de la ville (PLAN-07).

**Photo facultative :**
- Champ `attachment` envoyé en multipart via `fileHttp`, avec aperçu.
- Formats jpg, png ou webp, 10 Mo au plus. Le message d'erreur doit être clair si le fichier est refusé.

**Envoi :**
`POST /api/requests { type: 'INCIDENT', subject, message, category, district_id, location_label, latitude?, longitude?, data: { urgency_hint }, attachment? }`

**Faisceau 3D :**
- Il suit le statut réel (voir le tableau du § 4.6).
- Il s'affiche au-dessus du quartier du signalement, grâce à une table `DISTRICT_ANCHOR: Record<codeQuartier, AnchorId>` dans `features/reports/`. Les correspondances sont à définir avec la scène, par exemple CENTRE → `central` et OUEST → `serre`.

### 4.3 Faire une démarche en ligne (D11) : `/ville/demarches/:slug`

- `GET /api/procedures/:slug` donne la description, les pièces à fournir (sous forme de liste à cocher pour se préparer), le délai estimé, le service et sa disponibilité (F38, avec `AvailabilityNotice` du PLAN-02).
- Le formulaire est généré à partir de `form_schema` :
  - types `text`, `textarea`, `date`, `number`, `select` (avec ses `options`) ;
  - champs obligatoires signalés par `required` ;
  - construit avec les primitives accessibles du PLAN-00 (F6).
- Envoi : `POST /api/requests { type: 'PROCEDURE', procedure_id, subject: 'Démarche : <titre>', message, data }`
- Un champ obligatoire manquant renvoie une erreur 400, affichée sur le champ concerné. Une erreur 409 `SERVICE_UNAVAILABLE` s'affiche avec `AvailabilityNotice`.

### 4.4 Confirmation (D16) : composant `RequestConfirmation`, commun aux trois types

Il remplace le formulaire : un simple toast ne suffit pas.

**Contenu :**
- une icône et « Demande envoyée » ;
- la **référence**, avec un bouton pour la copier ;
- le message du backend ;
- la suite : « un agent va la prendre en charge, vous serez prévenu·e », plus le délai estimé pour une démarche ;
- deux boutons : « Suivre ma demande » et « Envoyer une autre demande ».

**Comportement :**
- Le focus va sur le titre, et l'annonce passe par `role="status"`.
- La notification créée par le serveur apparaît dans la cloche (PLAN-04).

**Pas de doublon :**
- Le bouton est désactivé pendant l'envoi, et `useApiForm` ignore un second envoi.
- Une erreur `429` (limite par IP) affiche un message clair.

### 4.5 Mes demandes (D11, F26) : `/ville/espace/demandes`

**Onglets :**
- « En cours » (`scope=open`)
- « À compléter » (statut `WAITING_CITIZEN`, mis en avant avec un compteur)
- « Terminées » (`scope=closed`)
- « Toutes »

Une recherche (`q`) et la pagination complètent la liste.

**Chaque ligne affiche :**
- le type, avec une icône et un texte ;
- l'objet et la référence ;
- le statut, sous forme de pastille avec texte et icône ;
- la date de dernière mise à jour, en relatif ;
- la prochaine étape.

**F26 :** l'historique inclut les demandes clôturées. Un bouton « Refaire une demande similaire » préremplit le formulaire du même type.

### 4.6 Détail d'une demande (D11) : `/ville/espace/demandes/:id`

**Frise des étapes :** Reçue → En examen → En cours → Résolue, avec trois issues particulières : « Votre réponse est attendue », « Refusée » et « Clôturée ».

La correspondance entre statuts est définie une seule fois, dans `src/api/requestStatus.ts`, et partagée avec le back-office :

| Statut API | Étape vue par l'habitant | Faisceau 3D (`setSignalStatus`) |
|---|---|---|
| `SUBMITTED` | Reçue | 0 |
| `IN_REVIEW` | En examen | 1 |
| `IN_PROGRESS` | En cours | 2 |
| `WAITING_CITIZEN` | Votre réponse est attendue | 1 |
| `RESOLVED` | Résolue | 3 |
| `CLOSED` | Clôturée | 3 |
| `REJECTED` | Refusée, avec le motif | -1 (éteint) |

**Le reste de la page :**
- L'historique daté des événements publics : qui (service ou agent), quoi, quand, avec la note éventuelle.
- La réponse de l'habitant, via `POST /api/requests/:id/comments`. Le champ est mis en avant quand le statut est `WAITING_CITIZEN`.
- Un récapitulatif : réponses de la démarche, pièce jointe, lieu.
- La page se rafraîchit toutes les 30 s tant que la demande est ouverte.

`ReportTracker`, dans la section du survol, reprend ce modèle et perd son bouton « Faire avancer la démonstration ».

## 5. Back-office

### Lectures et actions par page

| Page | Lecture | Actions |
|---|---|---|
| `AgentDashboardPage` (D17, F22) | `GET /api/dashboard/stats` toutes les 30 s (détail des champs ci-dessous) | « Prendre en charge » : `PATCH { status: 'IN_REVIEW', assigned_agent_id: <moi> }`. Les encarts Activité et Nova Terra relèvent du PLAN-10. |
| `RequestsPage` (F22) | `GET /api/requests?scope=&status=&type=&priority=&assigned=&q=&sort=&page=` (filtres gardés dans l'URL) | Puce « Nécessite une action » = `scope=needs_action`, avec un compteur. Tri et pagination côté serveur. |
| `RequestDetailPage` (D11, F22, F26) | `GET /api/requests/:id` (événements internes compris) et `GET /api/requests?citizen_id=` pour les autres demandes du citoyen | Voir le tableau suivant. |
| `ReportsPage` (F25) | `GET /api/requests?type=INCIDENT&scope=open&district_id=`. La carte des quartiers utilise `incidents_by_district`. | « Prendre en charge ». La photo est affichée depuis `imgUrl`, et la position sur le plan si le PLAN-07 est livré. |
| `RequestsSupervisionPage` (D17, admin) | Statistiques `open_by_agent`, `overdue` et `by_status` | Réassignation, groupée si `POST /bulk` existe. |
| Badge `awaiting` du menu (D17) | `stats.requests.awaiting_pickup`, rafraîchi toutes les 30 s | — |

**Tableau de bord, détail des champs :**
- jauge : `awaiting_pickup` ;
- tuiles : `needs_action`, `assigned_to_me`, `unassigned_open` et `oldest_awaiting` ;
- file prioritaire : `queue`.

### Actions de `RequestDetailPage`

| Fonction simulée | Appel API |
|---|---|
| `changeStatus` | `PATCH { status, note, internal_note }` |
| `assignRequest` | `PATCH { assigned_agent_id }`, avec la liste du personnel issue de `GET /api/users/staff` |
| `setPriority` | `PATCH { priority }` (l'urgence proposée par l'habitant est affichée à côté) |
| `addComment` | `POST /:id/comments { message, is_internal }` |

`requestStore` est supprimé. `mocks/requests.ts` sert d'abord à alimenter le seed (PLAN-00, B3).

## 6. Étapes

- [ ] Backend : filtre `citizen_id` ; ajouts à `dashboard/stats` (`open_by_agent`, `overdue`, `incidents_by_district`) ; `bulk` en option
- [ ] `src/api/requests.ts`, `requestStatus.ts` et `dashboard.ts`
- [ ] `RequestConfirmation`
- [ ] Contact `/ville/contact`, avec un lien depuis le sas
- [ ] Signalement branché : quartiers de l'API, lieu, position, photo, faisceau réel ; mise à jour des tests de `analyzeReport`
- [ ] Démarche dynamique `/ville/demarches/:slug`
- [ ] `/ville/espace/demandes` et `/ville/espace/demandes/:id`
- [ ] Back-office : tableau de bord, liste, détail, signalements, supervision, badge
- [ ] Suppression de `requestStore` et de la logique de démonstration de `reportStore`

## 7. Critères d'acceptation

1. **D04.** Avec ou sans compte, un message envoyé affiche une confirmation et une référence, puis apparaît dans la liste de l'agent.
2. **D16.** La confirmation est immédiate et donne la référence, la suite et une notification. Un double clic ne crée qu'une seule demande.
3. **F25.** « Lampadaire cassé devant le 12 rue des Lilas », avec le quartier proposé et une photo, apparaît dans les Signalements de l'agent, sur le bon quartier, avec la photo visible.
4. **D11.** L'habitant voit toutes ses demandes, leur état et les étapes datées. Quand l'agent passe la demande « En cours », la frise et le faisceau changent en 30 s au plus, et l'habitant reçoit une notification.
5. **F26.** Les demandes clôturées restent dans l'historique et se retrouvent par mot-clé.
6. **F22.**
   - L'agent filtre « Nécessite une action », ouvre une demande, change son état, l'assigne et la commente.
   - Une note interne reste invisible pour l'habitant : à vérifier depuis son compte.
7. **D17.** Le nombre de demandes en attente de prise en charge est visible sur chaque écran du back-office (badge) et sur le tableau de bord. Il baisse dès qu'un agent en prend une.

## 8. Version minimale

**À faire en premier :**
- le signalement et le contact branchés, avec leur confirmation ;
- la page « Mes demandes » et le détail d'une demande ;
- côté agent, la liste, le détail (statut, assignation, commentaire), le tableau de bord et le badge D17.

**Peut attendre :** le formulaire de démarche dynamique, la position GPS, la photo, la supervision admin et la réassignation groupée.

## 9. Points d'attention

- **Photos des signalements :** elles sont servies publiquement depuis `/public/<fichier>`. Le nom aléatoire suffit pour la démo. Pour un vrai déploiement, il faudrait un téléchargement authentifié.
- **Statuts :** n'afficher jamais les codes bruts (`IN_REVIEW`, etc.). Tout libellé passe par `requestStatus.ts`, ce qui sert aussi D13 (PLAN-09).
