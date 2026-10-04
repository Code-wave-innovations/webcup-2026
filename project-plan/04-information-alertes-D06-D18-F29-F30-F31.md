# PLAN-04 : information, alertes et notifications

> **Réfs :** D06 · D18 · F29 · F30 · F31. **XP :** 3 330.
> **Dépend de :** PLAN-00 et PLAN-01.
> **Débloque :** PLAN-05, car les rappels de rendez-vous arrivent dans le centre de notifications.
> **Effort :** environ 5 h.

## 1. Pourquoi ces demandes vont ensemble

La ville a un seul canal pour informer les habitants, avec trois niveaux d'urgence :

- l'**annonce**, qu'on va consulter (D06) ;
- l'**annonce importante**, dont on est prévenu (F30) ;
- l'**alerte**, qui s'affiche d'office à l'écran (D18). Elle peut viser certains quartiers (F29) ou les personnes vulnérables, avec des recommandations adaptées (F31).

Ces trois niveaux s'appuient sur les mêmes notifications, le même bandeau et le même calcul du public visé (`audienceUserWhere` / `concernsUser` dans `alert.model.ts`). Ils se livrent donc ensemble.

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| D06 | Mairie | Retrouver et lire les publications de la ville | Liste filtrable et lecture du contenu complet |
| D18 | Haut Conseil | Diffuser vite un message général, visible au bon moment | Bandeau sur tous les écrans, y compris le sas, et notification |
| F29 | Centre de surveillance environnementale | Montée des eaux dans le quartier sud : prévenir vite les personnes concernées | Alerte ciblée sur le quartier : ses habitants sont notifiés, les autres non |
| F30 | Service Communication | Être prévenu quand une annonce importante est publiée | Cloche avec compteur, lien vers l'annonce |
| F31 | Agence sanitaire *(demande liée à l'IA)* | Canicule : prévenir les personnes vulnérables avec des recommandations adaptées | Notification ciblée et recommandations ; brouillon proposé par l'IA en option |

## 2. Existant

### Backend (prêt)

**Annonces :**
- `GET /api/announcements` (public) avec les filtres `category`, `q` et `status`. `status=ALL` est réservé au personnel.
- Création, modification et suppression, plus `POST /:id/publish` (personnel).
- Une annonce publiée avec `is_important` notifie tous les habitants.

**Alertes :**
- `GET /api/alerts/active` (public) ; le champ `concerns_me` est calculé quand la personne est connectée.
- `GET/POST /api/alerts`, `PATCH /:id`, `POST /:id/close` (personnel).
- Champs : `audience` (ALL / DISTRICTS / VULNERABLE), `district_ids`, `severity`, `instructions`, `recommendations` (`[{ title?, text, audience? }]`), `starts_at`, `ends_at`, `source`, `notify`.

**Notifications :**
- `GET /api/notifications`, `GET /unread-count`, `PATCH /:id/read`, `POST /read-all`, `DELETE /:id`.
- Types déjà envoyés par le serveur : demandes, messages, sécurité, rendez-vous, rappels, interruptions, transports, annonces et alertes.

### Front citoyen

- `AlertBanner` et `AnnouncementList` sont pilotés par un bouton « Simuler une alerte » (`directorStore.alert`).
- Les annonces sont écrites en dur (`announcements.ts`).
- Il n'y a pas de centre de notifications.

### Back-office

`AnnouncementsPage`, `AlertsPage` et `NotificationsPage` (diffusion et historique) sont simulées par `contentStore`.

## 3. Ce qui manque au backend

| Manque | Correctif |
|---|---|
| Diffusion libre depuis la page Notifications du back-office (F30) : aucun endpoint, aucun historique | Modèle `Broadcast` (champs ci-dessous). Ajouter `POST /api/notifications/broadcast` (admin) qui appelle `notifyUsers(where, …)` et enregistre `recipients`, puis `GET /api/notifications/broadcasts` (admin, paginé). |
| Afficher « N destinataires » avant l'envoi d'une alerte ou d'une diffusion | `GET /api/notifications/audience?audience=&district_ids=` (personnel) renvoie `{ count }` en réutilisant `audienceUserWhere`. |
| Viser le personnel dans une diffusion | Valeur `STAFF`, réservée aux diffusions (pas aux alertes) : cible les rôles AGENT et ADMIN. |
| Recommandations adaptées (F31, liée à l'IA) — **optionnel** | `POST /api/alerts/assist` (personnel), détaillé ci-dessous. |

**Modèle `Broadcast` :** `id`, `created_at`, `title`, `body`, `link?`, `audience` (ALL / DISTRICTS / VULNERABLE / STAFF), `district_ids Json?`, `recipients Int`, `sent_by_id`.

**Endpoint `POST /api/alerts/assist` (optionnel) :**
- Entrée : `{ situation, audience, severity }`.
- Sortie : un brouillon `{ title, message, instructions, recommendations[] }`.
- Génération par Claude, via `@anthropic-ai/sdk` et `ANTHROPIC_API_KEY` côté backend. Modèle `claude-sonnet-5-5`, ou `claude-haiku-4-5-20251001` pour aller plus vite.
- Le prompt impose :
  - un langage simple ;
  - des consignes concrètes ;
  - un numéro à appeler ;
  - aucune information médicale inventée.
- Le brouillon est **toujours relu** avant publication.
- Sans clé API, l'endpoint renvoie des modèles intégrés : canicule, montée des eaux, qualité de l'air, coupure d'eau.

## 4. Front citoyen

### 4.1 Bandeau d'alerte (D18, F29, F31) : `features/announcements/AlertBanner.tsx`

**Source et tri :**
- `GET /api/alerts/active`, rafraîchi toutes les 60 s, y compris sur le sas pour les personnes non connectées.
- Les alertes qui me concernent (`concerns_me`) passent en premier, puis le tri se fait par gravité.

**Contenu affiché :**
- La gravité, indiquée par une icône et un libellé : « Alerte critique », « Vigilance » ou « Information ». Jamais par la couleur seule.
- Le titre et le message.
- La zone concernée (« Quartier Sud », F29), avec la mention « Vous êtes concerné·e » si c'est le cas.
- **« Ce que vous devez faire »** (`instructions`).
- **Les recommandations** (F31). Celles destinées aux personnes vulnérables sont mises en avant si `is_vulnerable` est vrai.
- La période et la source.

**Comportement :**
- « Masquer » replie l'alerte ; ce choix est mémorisé localement pour cette alerte.
- Une alerte CRITICAL qui me concerne reste visible sous forme de bandeau réduit.
- `role="alert"` n'est posé que lorsqu'une **nouvelle** alerte apparaît, pas à chaque rafraîchissement.
- Quand une alerte CRITICAL me concerne, la scène 3D passe en mode alerte (`directorStore.setAlert(true)`, la ville devient rouge). Elle revient à la normale quand l'alerte est clôturée.
- Le bouton « Simuler une alerte » et les données écrites en dur sont supprimés.

### 4.2 Pages des alertes : `/ville/alertes` et `/ville/alertes/:id`

- Les alertes en cours qui me concernent d'abord.
- Les autres ensuite, sous l'intitulé « Ne concerne pas votre quartier ».
- La page de détail donne la chronologie, les consignes et les recommandations.

### 4.3 Annonces (D06) : section Haut Conseil, `/ville/annonces` et `/ville/annonces/:id`

**Section du survol :**
- Les 3 dernières annonces (`home.announcements`), avec une marque pour celles qui sont importantes.
- Un lien « Toutes les annonces ».

**Liste :**
- Filtres par catégorie : Actualité, Changement de service, Information pratique, Événement.
- Recherche et pagination.

**Détail :**
- Titre, date, catégorie, service lié et contenu.
- Le contenu s'affiche en paragraphes ou en Markdown sécurisé, **jamais** via `dangerouslySetInnerHTML`.

### 4.4 Centre de notifications (F30, utilisé aussi par D16, F37 et F40)

**La cloche dans la `TopBar` :**
- Elle affiche le nombre de notifications non lues (`unread-count`, rafraîchi toutes les 30 s).
- Elle ouvre un panneau avec les 20 dernières (`GET /api/notifications`).
- Actions : « Tout marquer comme lu » et suppression d'une notification.

**Ouverture d'une notification :** chaque type mène à sa cible.

| Type | Destination |
|---|---|
| Demande | PLAN-03 |
| Rendez-vous | PLAN-05 |
| Annonce | Page de l'annonce |
| Alerte | Page de l'alerte |
| Sécurité | Profil |

Une table `NOTIFICATION_TARGETS` dans `features/notifications/` fait cette correspondance.

**Annonce aux lecteurs d'écran :** quand le compteur augmente, une annonce discrète (`aria-live="polite"`) indique « 1 nouvelle notification ».

**Page complète :** `/ville/espace/notifications`.

## 5. Back-office

| Page | Lecture | Actions |
|---|---|---|
| `AnnouncementsPage` (D06, F30) | `GET /api/announcements?status=ALL&category=&q=` | Brouillon : `POST`. Modifier : `PATCH /:id`. Publier : `POST /:id/publish`. Archiver : `PATCH { status: 'ARCHIVED' }`. Supprimer : `DELETE`. Case « Importante : prévenir tous les habitants » (`is_important`), avec le nombre estimé de destinataires. |
| `AlertsPage` (D18, F29, F31) | `GET /api/alerts`, actives et passées | Voir le détail ci-dessous. |
| `NotificationsPage` (F30) | `GET /api/notifications/broadcasts` | `sendBroadcast` → `POST /api/notifications/broadcast`, avec le nombre estimé de destinataires. |
| Badge `activeAlerts` du menu | `stats.platform.active_alerts` (dashboard, PLAN-03) | — |

**Détail de `AlertsPage` :**
- **Créer** (`createAlert`) : `POST` avec `{ title, message, severity, audience, district_ids, instructions, recommendations, starts_at, ends_at, notify }`.
- **Clôturer** (`closeAlert`) : `POST /:id/close`.
- **Estimer le public** : `GET /api/notifications/audience`, affiché avant l'envoi.
- **Bouton « Proposer un brouillon »** (`/assist`, optionnel).
- **Aperçu du bandeau**, tel qu'il apparaîtra à un habitant concerné et à un habitant non concerné.

`stores/contentStore.ts` et `mocks/content.ts` sont supprimés ; leur contenu sert d'abord à enrichir le seed.

## 6. Étapes

- [ ] Backend : modèle `Broadcast` et sa migration, endpoint de diffusion, historique, estimation du public, `STAFF`
  - [x] Estimation du public : `GET /api/notifications/audience` (personnel)
  - [x] Alertes programmées (D18) : `Alert.notify`, `notified_at`, `recipients` ; le planificateur et la tâche cron notifient l'alerte quand elle commence, une seule fois
  - [ ] `Broadcast`, diffusion libre et historique, `STAFF`
- [ ] Backend (optionnel) : `/api/alerts/assist` avec les modèles intégrés, puis Claude si la clé est présente
- [ ] `src/api/announcements.ts`, `alerts.ts` et `notifications.ts` (`alerts.ts` fait ; `announcements.ts` en lecture seule pour le survol)
- [x] `AlertBanner` réel et mode alerte 3D ; suppression de la simulation : `AlertCenter` dans `FilmLayout` (tous les écrans, sas compris), transmission plein écran pour chaque alerte non lue qui me concerne, puis bandeau ; une alerte critique qui me concerne met la ville en rouge et Nova lit les consignes
- [ ] `/ville/alertes` et `/ville/alertes/:id`
- [ ] Section Haut Conseil, `/ville/annonces` et `/ville/annonces/:id`
- [ ] Cloche, panneau de notifications et `/ville/espace/notifications`
- [ ] Back-office : `AnnouncementsPage`, `AlertsPage`, `NotificationsPage` et badge
- [ ] Seed : 1 alerte SUD (montée des eaux), 1 alerte VULNERABLE (canicule) avec recommandations, 3 annonces dont 1 importante

## 7. Critères d'acceptation

1. **D06.** Depuis l'accueil, l'habitant retrouve les annonces, les filtre par catégorie et lit leur contenu complet.
2. **D18.** L'admin publie un message général. En 60 s au plus, le bandeau apparaît :
   - chez tous les habitants connectés ;
   - sur le sas, pour les visiteurs non connectés.
3. **F29.** Alerte « Montée des eaux » ciblée sur le quartier Sud :
   - un habitant du Sud voit « Vous êtes concerné·e » et reçoit une notification ;
   - un habitant du Nord n'est pas notifié et ne voit l'alerte que dans la liste.
4. **F30.** Après la publication d'une annonce importante, le compteur de la cloche augmente de 1 chez chaque habitant, et un clic ouvre l'annonce.
5. **F31.** Alerte canicule destinée aux personnes vulnérables :
   - `senior@` reçoit la notification et voit des recommandations adaptées (boire, horaires à éviter, numéro d'aide) ;
   - `citoyen@`, non vulnérable, n'est pas notifié.
   - Avec l'option IA, le brouillon est proposé en moins de 10 s et relu avant l'envoi.

## 8. Version minimale

**À faire en premier :**
- le bandeau d'alerte réel ;
- la cloche et le panneau de notifications ;
- les annonces côté citoyen ;
- `AnnouncementsPage` et `AlertsPage` (création, ciblage, clôture).

**Peut attendre :** la diffusion libre (`Broadcast`), l'estimation du public, le brouillon par IA et le mode alerte 3D.

## 9. Points d'attention

- **E-mails et SMS :** aucun service d'envoi n'existe. Les habitants sont prévenus par une notification dans l'application et par le bandeau. Le dire au jury ; c'est une extension possible.
- **Clé Anthropic :** elle reste uniquement côté backend, jamais dans une variable `VITE_*`.
- **Un seul canal de rafraîchissement :** le bandeau (alertes) et la cloche (notifications) se rafraîchissent indépendamment. Une même alerte qui notifie apparaît aux deux endroits ; c'est voulu.
