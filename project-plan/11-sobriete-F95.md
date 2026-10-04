# PLAN-11 : sobriété numérique

> **Réfs :** F95 · **XP :** 1 320
> **Dépend de :** PLAN-00 (couche `src/api`, `REFRESH`) et la version légère de F96 (PLAN-08, `src/a11y/sceneMode.ts`)
> **Débloque :** rien ; les plans suivants appliquent ses règles (§ 8)
> **Effort :** environ 6 h

## 1. Besoin

Demande F95, Service environnement (« 7 — Assistance et résilience ») : « Nos mesures montrent que certaines pages chargent encore trop de ressources et déclenchent des requêtes inutiles. Réduisez ce qui n'est pas nécessaire afin de conserver une plateforme plus sobre et plus efficace. »

Ce plan vise deux choses :
- **Ressources** : une page ne télécharge que ce qu'elle affiche. Le film 3D et le modèle de Nova restent sur les routes du film.
- **Requêtes** : rien n'est interrogé plus souvent que nécessaire. On ne fait pas de requête vouée à l'échec, et on n'en fait pas une par élément quand une seule suffit.

Le résultat se prouve par une mesure faite avant et après, sur les mêmes routes (§ 7).

## 2. Existant

### Déjà sobre (à garder)

- `compression()` dans `backend/index.ts`.
- TanStack Query met le polling en pause quand l'onglet est caché.
- Les recherches sont différées de 250 à 300 ms.
- La liste des notifications n'est chargée qu'à l'ouverture du panneau.
- `frameloop="demand"` sur les pages console (`Film.tsx`, `FrameLoopGovernor`), avec `detectQuality` et `ResolutionGovernor`.
- La ville est générée dans un worker, sans aucun fichier de ville.
- **F96, version légère** (`src/a11y/sceneMode.ts`, PLAN-08) :
  - pas de 3D, de `nova.glb`, de voix ni de polices décoratives ;
  - activée d'office avec Save-Data, `prefers-reduced-data`, une connexion 2G ou sans WebGL2, et réglable par le visiteur ;
  - en version légère, `REFRESH` est multiplié par 3 (sauf `alerts`).
  - F95 ne crée **pas** de second interrupteur et s'appuie sur ce mode.

### Ce qui coûte (audit du 4 oct., build du commit `ed5658c`)

| Problème | Où | Coût |
|---|---|---|
| Le moteur 3D est préchargé sur toutes les routes, back-office compris | `vite.config.ts` : le groupe `three` attire React, zustand… (`includeDependenciesRecursively` est vrai par défaut) | `three-*.js` : 1,09 Mo (296 Ko gzip) |
| `nova.glb` est préchargé dès l'import du module | `experience/nova/stage/NovaActor.tsx` (`useGLTF.preload` au niveau du module) | 861 Ko, même sur `/agent` et `/equipe` |
| Le back-office forme un seul chunk (22 pages importées statiquement) | `backoffice/BackofficeApp.tsx` | 439 Ko |
| Le shell staff interroge `/dashboard/stats` (19 requêtes SQL) toutes les 30 s pour 3 badges, et la liste des interruptions pour un `.length` | `backoffice/layout/useBadges.ts` | |
| Tendances, résumé et audit sont interrogés même en vue simple, l'audit toutes les 15 s | `AdminOverviewPage`, `AgentDashboardPage` | |
| Les clés d'`ActivityPage` changent chaque minute (`from` arrondi à la minute) | `backoffice/lib/periods.ts` | 4 refetch forcés par minute |
| Une requête par arrêt, toutes les 60 s ; la liste des lignes est aussi interrogée | `api/transit.ts` (`useTransitStopsDepartures`) | N + 3 requêtes par minute |
| `useProcedures` recharge ce que `useService` renvoie déjà | `features/services/ServiceTerminal.tsx` | |
| La déconnexion relance les requêtes actives sans jeton | `api/session.ts` (`resetServerCache`) | rafale de 401 |
| `/equipe` appelle `/api/users` sans session | `pages/TeamPage` | une 401 à chaque visite |
| 21 POST TTS Swiftask dès le sas, avant la connexion | `experience/audio/SoundDirector.tsx` (`warmSpeech`) | 5 à 10 s chacun |
| face-api est chargé depuis jsDelivr, et le worker (avec son modèle) est recréé à chaque pause | `workers/faceDetection.worker.ts`, `features/auth/useFacePresence.ts` | |
| Logos PNG de 2000 px affichés à 40–200 px, `<img>` sans dimensions ni `loading="lazy"` | `TeamPage`, `FaceUnlock`, `RequestDetailPage` | 170 Ko |
| `/public` sans `maxAge` | `backend/index.ts` | chaque image est revalidée |
| Les listes renvoient les champs texte longs (`content`, `description`, `message`, `data`) | `announcement.model.ts`, `cityService.model.ts`, `citizenRequest.model.ts` | |

## 3. Backend

- `GET /api/dashboard/badges` (`requireStaff`) renvoie `{ awaiting_pickup, active_alerts, appointments_today, current_interruptions }` :
  - 4 `count()`, avec un cache de 15 s par processus (même schéma que `getSetting()`) ;
  - la route est déclarée dans `lib/permissions.ts`.
- `GET /api/transit/departures?stops=1,2,3&limit=20` (`optionalAuth`) renvoie les prochains départs de plusieurs arrêts en une requête. `/stops/:id` reste disponible pour la fiche d'un arrêt.
- Listes allégées par `select` :
  - annonces : `excerpt` à la place de `content` ;
  - services : sans `description` si aucune carte ne l'affiche ;
  - demandes : sans `message` ni `data`.
  - On vérifie d'abord ce que lit chaque écran.
- `dashboard.model.ts` (`pickups()`) : le filtre de date passe de `having` à `where`.
- `express.static('/public', { maxAge: '30d', immutable: true })` : les noms de fichiers sont horodatés par `uploadFile` et ne sont jamais réécrits.
- Si le temps le permet : calculer les verrous F37 de la liste des utilisateurs en une seule requête groupée.

## 4. Front citoyen

- **Bundles** :
  - `vite.config.ts` : `includeDependenciesRecursively: false`, et des groupes `react` / `three` / `r3f`.
  - Routes du film en `lazy` (fait par F96 dans `App.tsx`).
  - `RegisterFacePanel` en `lazy` dans `AccessHologram`.
- **Requêtes** :
  - annonces sans polling (`staleTime` de 5 min) ;
  - liste des lignes de transport sans polling (`staleTime` de 10 min) ;
  - départs groupés en une requête ;
  - `ServiceSheet` lit les démarches renvoyées par `useService` ;
  - à la déconnexion, seules les requêtes publiques sont relancées.
- **Tiers et médias** :
  - modèle face-api servi depuis `public/models/face-api/` ;
  - worker visage conservé pendant les pauses ;
  - `warmSpeech` seulement une fois la ville atteinte ;
  - logos en WebP à 2× leur taille d'affichage, avec dimensions et `loading="lazy"` ;
  - `/equipe` ne fait plus d'appel authentifié.

## 5. Back-office

- Une page = un `lazy()`, avec un fallback `Skeleton`.
- `useBadges` passe sur `/dashboard/badges`, toutes les 60 s.
- Tableaux de bord :
  - tendances et résumé toutes les 5 min (`REFRESH.trends`) ;
  - tendances, résumé et audit coupés en vue simple ;
  - audit des tableaux de bord toutes les 30 s (le mode `live` d'`AuditPage` reste à 15 s).
- `ActivityPage` : `from` figé au montage. `ReportsPage` : pas de liste en double sans district.
- Liste des notifications ouverte : pas de polling en plus de `unread-count`.
- Terra Nova : une 503 (clé absente) arrête les réessais et le polling.

## 6. Étapes

Chaque étape est validée avant de passer à la suivante.

- [x] **0. Fiche et mesure de référence** : ce fichier, la matrice du README, `terraNovaPlans.ts`, et la colonne « avant » du § 7.
- [x] **1. Bundles** : `vite.config.ts`, back-office en `lazy`, `RegisterFacePanel` en `lazy`. Contrôle : `dist/index.html` ne précharge plus three, et `/agent` ne télécharge ni three ni `nova.glb`.
- [ ] **2. Version légère (F96)** : vérifier qu'en `?leger=1` aucune ressource 3D n'est téléchargée. Corriger les fuites restantes, par exemple `director` → `postprocessing` via `post/FilmEffect`.
- [ ] **3. Requêtes côté client** : `REFRESH`, les `enabled`, `ActivityPage`, `ReportsPage`, `ServiceSheet`, Terra Nova, déconnexion, `/equipe`.
- [ ] **4. Backend** : `/dashboard/badges`, `/transit/departures`, listes allégées, `pickups()`, `maxAge` sur `/public`, documentés dans `backend/README.md`.
- [ ] **5. Médias et tiers** : logos, face-api, `warmSpeech`, suppression des fichiers inutilisés (`src/assets/Meshy_AI_…glb` de 7,4 Mo, `public/icons.svg`…).
- [ ] **6. Mesure finale** : colonne « après » du § 7, Suivi du README, `CLAUDE.md`.

## 7. Mesures

**Méthode** :
- On fait un build de production servi par `vite preview` sur `:4180`, qui relaie `/api` et `/public` vers le backend local.
- Chrome headless démarre avec un profil neuf à chaque route.
- On compte les requêtes et les octets reçus jusqu'au repos du réseau (+ 3 s), puis les requêtes d'API pendant 2 minutes sans interaction.
- Les appels TTS Swiftask sont comptés mais interrompus, pour ne pas consommer de crédits de voix.
- Le back-office est mesuré avec les comptes du seed.

Chargement d'une page, profil neuf, version complète :

| Route | Avant (commit `ed5658c`) | Après étape 1 | Écart |
|---|---|---|---|
| `/agent` | 20 req · 1 679 Ko (3D + `nova.glb`) | 32 req · 357 Ko, sans 3D | **−79 %** |
| `/admin` | 22 req · 1 673 Ko (3D + `nova.glb`) | 36 req · 355 Ko, sans 3D | **−79 %** |
| `/agent/activite` | 21 req · 1 670 Ko (3D + `nova.glb`) | 33 req · 347 Ko, sans 3D | **−79 %** |
| `/equipe` | 15 req · 1 636 Ko (3D + `nova.glb`) | 17 req · 342 Ko, sans 3D | **−79 %** |
| `/` (sas) | 12 req · 1 520 Ko | 49 req · 1 558 Ko (+ 24 POST TTS) | film inchangé |
| `/ville?vue=0` | 11 req · 1 469 Ko | 53 req · 1 562 Ko (+ 21 POST TTS) | film inchangé |

- Le nombre de requêtes augmente parce que les chunks sont plus fins : chaque page ne télécharge que son propre code. Les chunks `api` et `bo-ui` évitent déjà une vingtaine de fichiers d'1 Ko.
- Sur les routes du film, regrouper davantage ferait retélécharger face-api ou la 3D ailleurs, d'où cet arbitrage : ce sont des fichiers statiques, mis en cache et servis en parallèle.
- Les POST TTS viennent de `warmSpeech` (traité à l'étape 5). Le build de référence ne les déclenchait pas pendant la fenêtre de chargement.

Requêtes d'API à l'arrêt, avant (2 min sans interaction) : `/admin` 14/min, `/agent` 11,5/min, `/agent/activite` 18/min (dont `/audit-logs` toutes les 5 s environ), sas et ville 1/min. Les mesures « après » viendront aux étapes 3 et 4.

## 8. Critères d'acceptation

**F95 :**
- Les routes hors film (`/agent`, `/admin`, `/equipe`, `/face`, `/transcription`) ne téléchargent ni le moteur 3D ni `nova.glb`.
- En version légère (F96), aucune ressource 3D n'est téléchargée, et toutes les fonctions restent accessibles.
- Il y a moins de requêtes par minute sur le shell staff, les tableaux de bord et les transports, chiffrées avant et après au § 7.
- Aucune requête vouée à l'échec : ni 401 à la déconnexion ou sur `/equipe`, ni polling Terra Nova sans clé.
- Aucune ressource tierce au chargement : pas de jsDelivr, pas de TTS avant l'arrivée en ville.
- Règles pour les plans suivants :
  - une route de liste n'envoie pas les champs texte longs ;
  - un compteur a son propre endpoint léger ;
  - un écran qui affiche N éléments fait une seule requête.

## 9. Version minimale

- Étape 1.
- `useBadges` sur `/dashboard/badges`.
- `enabled` en vue simple.
- Départs groupés.
- Mesure avant et après.
