# BO-07 : information et diffusion — annonces, alertes, notifications

> **Rôle :**
> - Admin : tout.
> - Agent : publier des annonces et des alertes, comme le backend l'autorise déjà au personnel.
>
> **Réfs :** D06 · D18 · F29 · F30 · F31. **XP :** 3 330.
> **Dépend de :** BO-00. Le BO-03 est recommandé, pour l'audit des publications.
> **Pendant citoyen :** PLAN-04 de `project-plan/`. Le même ajout backend (`Broadcast`, audience) sert les deux plans.
> **Effort :** ≈ 4 h.

## 1. Pourquoi ces réfs vont ensemble

Les cinq demandes portent sur **la publication d'une information vers les habitants**, au bon moment et pour les bonnes personnes. Elles partagent deux outils :
- **le composeur d'alerte**, pour D18, F29 et F31 : un message général, un quartier ou les personnes vulnérables ;
- **l'éditeur d'annonces**, pour D06 et F30 : une publication, et la notification si elle est importante.

| Réf | Demandeur | Besoin | Ce que le back-office doit permettre |
|---|---|---|---|
| D06 | Mairie | Publier des annonces, changements de service et informations pratiques | Rédiger, prévisualiser, publier, archiver |
| D18 | Haut Conseil | Diffuser rapidement un message général, visible au bon moment, compréhensible immédiatement | Une alerte « tous les habitants », avec début, fin, consignes et aperçu du bandeau |
| F29 | Surveillance environnementale | Montée des eaux dans le quartier Sud : informer vite les habitants concernés | Une alerte ciblée par quartier, avec le nombre de personnes touchées avant l'envoi |
| F30 | Service Communication | Prévenir les habitants quand une annonce importante est publiée | La case « Importante : prévenir tous les habitants » de l'annonce, et l'historique des diffusions |
| F31 | Agence sanitaire | Canicule : prévenir vite les personnes vulnérables, avec des recommandations adaptées | Une alerte de public « personnes vulnérables », avec des recommandations par public. Un brouillon assisté est facultatif. |

## 2. Écrans et état actuel

| Écran | Route | Aujourd'hui |
|---|---|---|
| `AnnouncementsPage` | `/admin/annonces` | `contentStore.saveAnnouncement` et `setAnnouncementStatus` |
| `AlertsPage` | `/admin/alertes` | `createAlert`, `closeAlert`, `estimateAudience`, qui est simulée (× 124) |
| `NotificationsPage` | `/admin/notifications` | `sendBroadcast` et `broadcasts` simulés |
| Badge `activeAlerts` | Menu | `contentStore` |

**Backend prêt :**
- **Annonces :**
  - `GET /api/announcements?status=ALL&category=&q=` (`ALL` est réservé au personnel) ;
  - `POST`, `PATCH /:id`, `POST /:id/publish` et `DELETE /:id`, pour le personnel ;
  - une annonce `is_important` publiée prévient tous les habitants.
- **Alertes :**
  - `GET /api/alerts`, `POST`, `PATCH /:id` et `POST /:id/close`, pour le personnel ;
  - champs : `audience` (`ALL`, `DISTRICTS` ou `VULNERABLE`), `district_ids`, `severity`, `instructions`, `recommendations` (`[{ title?, text, audience? }]`), `starts_at`, `ends_at`, `source` et `notify` ;
  - le ciblage est défini une seule fois dans `alert.model.ts` (`audienceUserWhere`), et l'envoi passe par `notifyUsers`.
- **Côté habitant :** le bandeau joue déjà un son d'alerte (`features/announcements/alertSound.ts`).

## 3. Backend : ce qui manque

Ce sont les mêmes ajouts que dans le PLAN-04, § 3.

| Manque | Correctif |
|---|---|
| Afficher « N destinataires » avant l'envoi | `GET /api/notifications/audience?audience=&district_ids=`, pour le personnel. Il renvoie `{ count }` en réutilisant `audienceUserWhere`. |
| Diffusion libre et son historique (F30) | Modèle `Broadcast` : `id`, `created_at`, `title`, `body`, `link?`, `audience` (`ALL`, `DISTRICTS`, `VULNERABLE` ou `STAFF`), `district_ids Json?`, `recipients Int`, `sent_by_id`. Endpoints, réservés aux admins : `POST /api/notifications/broadcast` et `GET /api/notifications/broadcasts`. Le serveur crée aussi une ligne `Broadcast` quand une annonce importante est publiée, pour que l'historique soit complet. |
| Taux de lecture d'une diffusion | `GET /api/notifications/broadcasts` ajoute `read_count`. Cela suppose d'enregistrer `broadcast_id` dans `data` des notifications envoyées. |
| Brouillon assisté (F31, **facultatif**) | `POST /api/alerts/assist { situation, audience, severity }` renvoie un brouillon `{ title, message, instructions, recommendations[] }`. Il est généré par Claude côté backend (`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, modèle `claude-haiku-4-5-20251001`). Le prompt impose un langage simple, des consignes concrètes, un numéro à appeler et aucune information médicale inventée. Sans clé, l'endpoint renvoie des modèles intégrés : canicule, montée des eaux, qualité de l'air, coupure d'eau. **Toujours relu avant publication.** |

## 4. Branchement écran par écran

Fichiers front :
- `src/api/announcements.ts` ;
- `src/api/alerts.ts` ;
- `src/api/notifications.ts` (audience, diffusions, et la cloche du BO-00).

### 4.1 `AnnouncementsPage` (D06, F30)

**Lecture :** `GET /api/announcements?status=ALL&category=&q=`, avec un filtre par statut (brouillon, publiée, archivée).

**Actions**

| Fonction simulée | Appel |
|---|---|
| `saveAnnouncement` (nouvelle) | `POST` (brouillon) |
| `saveAnnouncement` (existante) | `PATCH /:id` |
| `setAnnouncementStatus('PUBLISHED')` | `POST /:id/publish` |
| `setAnnouncementStatus('ARCHIVED')` | `PATCH { status: 'ARCHIVED' }` |
| Supprimer | `DELETE /:id`, avec confirmation |

**Éditeur**
- Un aperçu en direct montre la carte et la page de l'annonce, telles que l'habitant les verra.
- Case « Importante : prévenir tous les habitants » (F30) :
  - quand elle est cochée, elle affiche « N habitants recevront une notification », à partir de `audience?audience=ALL` ;
  - la publication demande une confirmation ;
  - le toast final rappelle le nombre de personnes prévenues.

**Formulaire :** `Field` et `ErrorSummary` (BO-00).

### 4.2 `AlertsPage` (D18, F29, F31)

**Lecture :** `GET /api/alerts`, avec les onglets « En cours » et « Passées ».

**Composeur**
- Titre et message.
- Gravité : information, vigilance ou critique. Chaque niveau a une icône et un mot, pas seulement une couleur.
- Public :
  - « Tous les habitants » (D18) ;
  - « Quartiers », avec une sélection sur `DistrictMap` (F29) ;
  - « Personnes vulnérables », qu'on peut limiter à certains quartiers (F31).
- Consignes : ce qu'il faut faire, en une ou deux phrases.
- Recommandations : une liste, chacune pouvant viser un public particulier (F31), par exemple « Personnes âgées : … ».
- Début et fin : « visible au bon moment ». Une alerte programmée apparaît « à venir ».
- Source.
- Case « Envoyer une notification » (`notify`).

**Avant l'envoi**
- Le nombre de destinataires : `GET /api/notifications/audience`, recalculé à chaque changement de public.
- Un aperçu du bandeau sous deux angles : « habitant concerné », qui voit le bandeau, les consignes et la notification, et « habitant non concerné », qui ne voit que l'information générale.
- Si le brouillon assisté existe, un bouton « Proposer un brouillon » remplit le formulaire. Le texte est marqué « À relire ».

**Actions**

| Fonction simulée | Appel |
|---|---|
| `createAlert` | `POST` avec `{ title, message, severity, audience, district_ids, instructions, recommendations, starts_at, ends_at, source, notify }`. Toast : « Alerte diffusée à N personnes ». |
| Modifier une alerte en cours | `PATCH /:id`. Elle ne renvoie pas de notification. |
| `closeAlert` | `POST /:id/close`, avec confirmation |

**Badge `activeAlerts` :** `stats.platform.active_alerts` (BO-01), ou le nombre de résultats de `GET /api/alerts/active`.

### 4.3 `NotificationsPage` (F30)

- **Lecture :** `GET /api/notifications/broadcasts` : titre, public, destinataires, taux de lecture, auteur, date.
- **Composeur :** `sendBroadcast` → `POST /api/notifications/broadcast`, avec le nombre de destinataires affiché avant l'envoi, et une confirmation au-delà de 100 personnes.
- **Public `STAFF` :** disponible uniquement ici, pour prévenir les agents et les admins.

## 5. Nettoyage

Sont supprimés :
- `stores/contentStore.ts`, avec `estimateAudience` ;
- `mocks/content.ts`.

## 6. Étapes

- [ ] Backend :
  - [x] `GET /api/notifications/audience` ;
  - [ ] `Broadcast`, `POST /broadcast` et `GET /broadcasts`, avec `read_count` ;
  - [ ] une ligne `Broadcast` pour les annonces importantes ;
  - [ ] audit.
- [ ] `src/api/announcements.ts`, `alerts.ts`, `notifications.ts`
- [ ] `AnnouncementsPage` : éditeur, aperçu, publication, nombre de personnes prévenues
- [x] `AlertsPage` : composeur, audience réelle, aperçu sous deux angles, clôture ; en plus : diffusion programmée, durée, notification facultative, annulation d'une diffusion programmée
- [ ] `NotificationsPage` : historique et diffusion
- [ ] Badge `activeAlerts`
- [ ] Facultatif : `POST /api/alerts/assist` et le bouton « Proposer un brouillon »
- [ ] Nettoyage

## 7. Critères d'acceptation

1. **F29.**
   - `admin@` crée l'alerte « Montée des eaux » sur le quartier Sud. Le compteur affiche le vrai nombre d'habitants du quartier.
   - Un habitant du Sud voit le bandeau et reçoit la notification.
   - Un habitant du Nord ne reçoit rien.
2. **F31.**
   - Une alerte « Canicule » destinée aux personnes vulnérables, avec deux recommandations, atteint `senior@`, mais pas `citoyen@`.
   - L'aperçu montre les deux points de vue.
3. **D18.**
   - Une alerte « tous les habitants » programmée dans 5 minutes apparaît « à venir », puis devient visible côté habitant à l'heure dite.
   - « Clôturer » la retire.
4. **D06 et F30.**
   - Une annonce enregistrée en brouillon n'apparaît pas côté habitant.
   - Publiée avec « Importante », elle apparaît, et tous les habitants ont une notification.
   - La diffusion figure dans l'historique de Notifications avec son nombre de destinataires.
5. Chaque publication, clôture et diffusion figure dans l'audit (BO-03).

## 8. Version minimale

À faire en premier :
- `AlertsPage` : création, clôture, audience réelle ;
- `AnnouncementsPage` : publication, avec la case « Importante ».

Peut attendre :
- `Broadcast` et `NotificationsPage` : la page affiche alors « Disponible prochainement » ;
- le taux de lecture ;
- le brouillon assisté.

## 9. Points d'attention

- **Une notification par personne :** `notify` envoie une notification par habitant ciblé. Sur une grosse base, passer à `createMany`, si `notifyUsers` ne le fait pas déjà.
- **Brouillon assisté :** `ANTHROPIC_API_KEY` reste dans `backend/.env`. Le texte produit n'est jamais publié sans relecture : le bouton remplit le formulaire, il ne publie pas.
