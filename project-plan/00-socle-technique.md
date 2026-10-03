# PLAN-00 : socle technique de la dynamisation

> **Réfs :** aucune en propre ; ce plan est un prérequis de tous les autres.
> **Dépend de :** rien. **Débloque :** les plans 01 à 10.
> **Effort :** ≈ 4 h (backend 1,5 h, front 2,5 h). **Statut :** à faire.

## 1. Objectif

Remplacer les données simulées par l'API Express sans réécrire chaque écran plusieurs fois. Ce plan met en place :

- **Une seule couche d'accès aux données**, `frontend/src/api/`, partagée par l'espace citoyen et le back-office.
- **Une session JWT commune** aux trois profils (citoyen, agent, admin).
- **Un contrat d'erreurs**, plus des primitives de formulaire accessibles réutilisées par tous les plans. C'est la base de F42.
- **Un squelette pour les pages citoyennes** qui vont au-delà du survol 3D.
- **Côté backend :**
  - des paramètres plateforme ;
  - un seed de démonstration aussi riche que les maquettes du back-office.

Aucun écran métier n'est branché ici. Seule exception : la page Paramètres du back-office, qui sert à tester le circuit complet (lecture puis écriture).

## 2. État actuel

| Zone | Constat |
|---|---|
| `frontend/src/hooks/useHttps.ts` | Les instances axios `http` (JSON) et `fileHttp` (multipart) sont prêtes mais ne sont utilisées nulle part. |
| Front citoyen | La session est une démo : `features/auth/*` avec les comptes `miora` et `conseil`, code vérifié dans la page. Services, annonces et signalement sont écrits en dur. |
| Back-office | Les stores zustand de `backoffice/stores/*` sont remplis par `backoffice/mocks/*`. Les types de `backoffice/mocks/types.ts` sont calqués sur l'API. `recordAudit()` est appelé côté navigateur. |
| Backend | Les modules des plans 01 à 06 existent, aux manques près listés dans chaque plan. `cors()` est ouvert à tous. Il n'y a pas de table de paramètres. Le seed est minimal. |
| Erreurs API | Format `{ error: { code, message, details } }`. Une erreur de validation zod donne `400 VALIDATION_ERROR` avec `details = { formErrors, fieldErrors }` (voir `middleware/error.ts`). |

## 3. Décisions

| # | Décision | Pourquoi |
|---|---|---|
| D-1 | **TanStack Query v5** gère l'état serveur. zustand reste pour la session et l'état d'interface. | Environ 40 écrans ont des filtres, de la pagination, une invalidation après mutation et un rafraîchissement périodique. Le recoder à la main dans des stores coûterait plus cher qu'ajouter la dépendance. |
| D-2 | La couche **`src/api/`** est partagée. | Le citoyen et le back-office consomment les mêmes endpoints. Le back-office n'est toujours pas importé depuis l'espace citoyen : les deux importent `src/api`. |
| D-3 | **Une seule session JWT**, stockée dans `localStorage` (clé `nova-auth`). | Les trois rôles utilisent le même `POST /api/auth/login`. Le rôle renvoyé décide de la destination : `/ville`, `/agent` ou `/admin`. |
| D-4 | **Rafraîchissement périodique ciblé** plutôt que WebSocket ou SSE. | L'API tourne sur cPanel derrière Passenger. Quelques `refetchInterval` suffisent pour la démo. Le SSE reste une extension possible. |
| D-5 | Les pages citoyennes au-delà du survol deviennent des **routes `/ville/*` dans un `ConsoleLayout`**, affiché au-dessus de la scène 3D atténuée. | Le survol (`/ville`) reste l'accueil (D07). Le catalogue, l'espace personnel, les transports, la carte, etc. ont besoin de leur propre URL, d'un retour arrière et d'un fil d'Ariane (D15). |
| D-6 | **Le seed backend reprend le scénario des maquettes.** | Une fois branchés, les écrans doivent rester aussi parlants que le design : 18 demandes, 10 citoyens, des créneaux, des alertes, etc. |

## 4. Backend

### B1. Paramètres plateforme

```prisma
// D07 / D08: platform settings edited by admins (key -> JSON value)
model PlatformSetting {
  key           String   @id @db.VarChar(64)
  value         Json
  updated_at    DateTime @updatedAt
  updated_by_id Int?
}
```

| Clé | Valeur par défaut | Lue par |
|---|---|---|
| `registration_open` | `true` | PLAN-01 : `POST /api/auth/register` répond `403 REGISTRATION_CLOSED` quand elle vaut `false` |
| `maintenance_banner` | `{ "enabled": false, "message": "" }` | PLAN-02 : bandeau global |
| `home_blocks` | `["alerts","shortcuts","featured_services","disruptions","announcements"]` | PLAN-02 : ordre et visibilité des blocs de l'accueil |
| `support_contact` | `{ "phone": "…", "email": "…", "hours": "…" }` | PLAN-03 (contact) et PLAN-07 (urgences) |
| `emergency_numbers` | `[{ "label": "SAMU", "number": "15" }, …]` | PLAN-07 (F46) |

**Implémentation :**
- `src/lib/settings.ts` :
  - `getSetting(key)` renvoie la valeur avec un défaut typé (un schéma zod par clé) et un cache mémoire de 30 s ;
  - `setSettings(partial, actorId)` enregistre plusieurs clés.
- Endpoints :
  - `GET /api/settings/public` : public, un sous-ensemble sans donnée sensible ;
  - `GET /api/settings` : admin ; renvoie aussi, en lecture seule, les seuils de `lib/loginGuard.ts` (5 échecs, fenêtre de 15 min, blocage de 15 min) ;
  - `PATCH /api/settings` : admin, mise à jour partielle validée clé par clé. Une fois le PLAN-10 (étape 1) livré, chaque modification est auditée.
- Fichiers :
  - `prisma/schema.prisma` ;
  - une migration (méthode `migrate diff` décrite dans `CLAUDE.md`) ;
  - `src/controller/settings.controller.ts` et `src/router/settings.router.ts` ;
  - le montage dans `index.ts`, avant les gestionnaires d'erreurs.

### B2. CORS

Dans `index.ts`, remplacer `cors()` par `cors({ origin: CORS_ORIGINS ? liste : true })`. `CORS_ORIGINS` est une liste séparée par des virgules, à documenter dans `.env.examle`. Sans cette variable, tout reste ouvert, comme aujourd'hui en développement.

### B3. Seed de démonstration

Reprendre dans `prisma/seed.ts` le scénario de `frontend/src/backoffice/mocks/{people,requests,content,appointments,catalog}.ts` :

- **Personnel :** Ada (ADMIN, `admin@novaterra.local`), Alex (AGENT, `agent@novaterra.local`), Hanta et Tiana (AGENT), Noa (ADMIN).
- **Citoyens :** 10 comptes répartis dans les 5 quartiers, dont :
  - `citoyen@novaterra.local` ;
  - 2 personnes vulnérables, dont `senior@novaterra.local` ;
  - 1 compte verrouillé (lignes `LoginAttempt` en échec) ;
  - 1 compte désactivé.
- **Demandes :** 18, couvrant les 3 types, les 7 statuts et les 4 priorités, avec des `RequestEvent` cohérents. Les dates sont relatives au moment où le seed s'exécute.
- **Créneaux et RDV :** des créneaux sur 7 jours, sauf le dimanche, et 11 rendez-vous.
- **Contenus :**
  - des annonces en brouillon, publiées et archivées ;
  - 2 alertes actives, dont une ciblant le quartier SUD ;
  - une interruption de service en cours et une à venir.
- **Idempotence :** chaque enregistrement est inséré ou mis à jour (upsert) selon une clé naturelle : e-mail, référence ou slug. `SEED_RESET=1` supprime les données de démonstration avant de les recréer.
- Les plans suivants complètent le seed : mots-clés (02), lieux (07), lexique (09), livraisons Terra Nova (10).

### B4. Contrat d'erreurs

Rien à modifier côté serveur. Il faut documenter le contrat dans `frontend/src/api/errors.ts` et vérifier que chaque `HttpError` métier a un `code` stable :

| Code | Statut HTTP |
|---|---|
| `INVALID_CREDENTIALS` | 401 |
| `ACCOUNT_LOCKED`, `IP_BLOCKED` | 429 |
| `SERVICE_UNAVAILABLE` | 409 |
| `REGISTRATION_CLOSED` | 403 |
| `VALIDATION_ERROR` | 400 |
| `CONFLICT` | 409 |
| `NOT_FOUND` | 404 |
| `FORBIDDEN` | 403 |

## 5. Front

### F1. Dépendance

- Ajouter `@tanstack/react-query@^5` aux `dependencies`, et `@tanstack/react-query-devtools` aux `devDependencies` (chargé uniquement en développement).
- Le `package-lock.json` actuel ne se résout pas avec npm 10.8 (voir `CLAUDE.md`). Il faut donc :
  1. ajouter la ligne dans `package.json` ;
  2. installer avec le gestionnaire qu'utilise l'équipe ;
  3. committer le fichier de verrouillage régénéré.

  En local, `npm install --no-package-lock --legacy-peer-deps` fonctionne, mais ne met pas ce fichier à jour.

### F2. Arborescence `src/api/`

```
src/api/
  client.ts       axios (reprend BaseUrl/rootApiUrl de hooks/useHttps.ts) + intercepteurs
  session.ts      store zustand persistant { token, user } ; useSession(), useRole(), signOut()
  errors.ts       ApiError, toApiError(), fieldErrors(), messageFor(code)
  queryClient.ts  QueryClient (staleTime 30 s, retry 1 sauf sur les 4xx) + intervalles de rafraîchissement
  types.ts        contrats de l'API (repris de backoffice/mocks/types.ts, recalés sur les vraies réponses)
  paginate.ts     Paginated<T> = { data: T[]; meta: { page, limit, total, pages } }
  <domaine>.ts    un fichier par domaine, ajouté par le plan qui le branche :
                  auth, me, users, security, permissions (01)
                  home, services, procedures, search, interruptions (02), settings (00)
                  requests, requestStatus, dashboard (03)
                  announcements, alerts, notifications (04)
                  appointments (05), transit (06), places (07), glossary (09)
                  audit, terraNova (10)
```

Chaque fichier de domaine suit la même forme :

```ts
export const requestKeys = {
  all: ['requests'] as const,
  list: (params: RequestListParams) => [...requestKeys.all, 'list', params] as const,
  detail: (id: number) => [...requestKeys.all, 'detail', id] as const,
}

export const useRequests = (params: RequestListParams) =>
  useQuery({
    queryKey: requestKeys.list(params),
    queryFn: () => http.get<Paginated<CitizenRequest>>('/requests', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

export const useUpdateRequest = () =>
  useMutation({
    mutationFn: ({ id, ...body }: RequestUpdate) => http.patch(`/requests/${id}`, body).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestKeys.all }),
  })
```

- **Notifications à l'écran :** les hooks n'affichent pas de toast. C'est l'écran qui le décide, avec `ui/toastStore.announce` côté citoyen et `stores/toastStore.toast` côté back-office.
- **Intercepteurs :**
  - ajout de `Authorization: Bearer <token>` quand une session existe ;
  - sur un `401` d'une requête authentifiée : `signOut()`, `queryClient.clear()`, puis émission de l'événement `nova:session-expired`. Chaque espace renvoie alors vers sa page de connexion avec un message.
- **`ApiError`** contient `{ status, code, message, details, retryAfter }` ; `retryAfter` est lu dans l'en-tête `Retry-After`.
  - `fieldErrors(err)` aplatit `details.fieldErrors` en `{ champ: premier message }`.
  - `messageFor(code)` traduit les codes connus en français.
- **Rafraîchissements de référence**, définis comme constantes dans `queryClient.ts` :

  | Donnée | Intervalle |
  |---|---|
  | Notifications non lues | 30 s |
  | Alertes actives | 60 s |
  | Statistiques des agents | 30 s |
  | Journal d'audit | 15 s |
  | Flux Terra Nova | 60 s |
  | Statut d'une demande ouverte | 30 s |

  Tous s'arrêtent quand l'onglet est caché, ce qui est le comportement par défaut de TanStack Query.

### F3. Providers

- Dans `main.tsx`, entourer `<App />` d'un `QueryClientProvider`, pour que les deux espaces en profitent.
- Charger les devtools uniquement si `import.meta.env.DEV`.

### F4. Squelette des pages citoyennes

- `/ville` (index) reste `CityPage`, c'est-à-dire le survol 3D.
- Une nouvelle route parente `/ville/*` affiche `pages/Console/ConsoleLayout.tsx`, qui :
  - réutilise la `TopBar`, sortie de `pages/CityPage/CityChrome.tsx` vers un composant partagé ;
  - contient `<main id="contenu" tabIndex={-1}>` et un lien d'évitement « Aller au contenu » ;
  - réserve un emplacement au fil d'Ariane, que le PLAN-02 (D15) remplit grâce au `handle.crumb` des routes et à `useMatches()` ;
  - à chaque navigation, place le focus sur le `h1` de la page et met à jour le titre du document (`"<Page> · NOVA"`) ;
  - atténue la scène 3D : un drapeau `console` dans `directorStore` active un voile CSS et réduit la cadence, à valider avec `experience/quality/`. En « Affichage simple » (PLAN-08), la scène n'est pas montée du tout.
- **Gardes :**
  - `RequireSession` : sans session, retour au sas avec `?retour=<url>` ;
  - `RequireRole` : réserve une route à certains rôles.
- Une route inconnue sous `/ville/*` affiche une page 404 dans la console.
- Les routes s'ajoutent comme enfants de `ville` dans `src/app/App.tsx`.

### F5. Back-office

- **Branchement :** il se fait page par page, chaque plan listant les siennes. Une page branchée ne lit plus aucun store simulé.
- **Nettoyage :** `stores/*` et `mocks/*` sont supprimés dès qu'aucune page ne les lit plus. `mocks/types.ts` est remplacé par `src/api/types.ts`. Le `recordAudit()` côté navigateur disparaît dès que le PLAN-10 (étape 1) est livré.
- **Compteurs :** `layout/useBadges.ts` lit les statistiques et les compteurs du serveur (PLAN-03, 04 et 05).
- **États d'écran :** `Skeleton` existant pendant le chargement. En cas d'erreur, un `EmptyState` avec un bouton « Réessayer » qui appelle `refetch`.
- **Page Paramètres** (`admin/pages/SettingsPage.tsx`) :
  - elle se branche sur `GET/PATCH /api/settings` ;
  - les seuils de sécurité y sont affichés en lecture seule ;
  - le choix de la langue reste simulé, car il relève du multilingue (exclu).

### F6. Primitives de formulaire accessibles

Elles sont la base de F42, détaillée dans le PLAN-08, et sont posées dès maintenant pour que les formulaires des plans 01 à 09 naissent conformes :

- **`ui/Field` (côté citoyen) :**
  - props `hint`, `error` et `required` ; ce dernier affiche la mention écrite « obligatoire » ;
  - attributs `aria-invalid` et `aria-describedby`, qui relient l'aide et l'erreur ;
  - identifiant généré automatiquement.
- **`ui/ErrorSummary` :** après l'envoi, liste les erreurs en tête du formulaire, avec un lien vers chaque champ. Il reçoit le focus et porte `role="alert"`.
- **`useApiForm()` :**
  - envoie une mutation ;
  - reporte `fieldErrors(err)` sur les champs ;
  - place le focus sur le résumé ;
  - empêche le double envoi.
- **Back-office :** son `Field` existe déjà (render-prop). Il faut lui ajouter `error` et un `ErrorSummary` sur le même modèle.

## 6. Étapes

- [ ] B1 : `PlatformSetting`, migration, `lib/settings.ts`, endpoints
- [ ] B2 : `CORS_ORIGINS`
- [ ] B3 : seed de démonstration (scénario des maquettes)
- [ ] F1 : dépendance TanStack Query
- [ ] F2 : `src/api/` (client, session, errors, queryClient, types, paginate, settings)
- [ ] F3 : providers dans `main.tsx`
- [ ] F4 : `ConsoleLayout`, gardes `RequireSession` et `RequireRole`, routes `/ville/*`, page 404
- [ ] F5 : `SettingsPage` branchée
- [ ] F6 : `Field`, `ErrorSummary` et `useApiForm` (citoyen et back-office)
- [ ] `CLAUDE.md` : décrire la couche `src/api` et ses conventions

## 7. Critères de sortie

- Après `npm run seed`, la page Paramètres affiche les vraies valeurs, et une modification survit au rechargement.
- Un token invalide ou expiré renvoie proprement au sas (citoyen) ou à la connexion du back-office, avec un message.
- Une route `/ville/test` de développement s'affiche dans la `ConsoleLayout`, avec focus sur le `h1` et lien d'évitement.
- Côté frontend, `npm run typecheck`, `npm run lint`, `npm run build` et `npm test` passent. Seules restent les 2 erreurs de lint déjà présentes dans `useRealtimeTranscription.ts`.
- Côté backend, `npm run typecheck` passe.

## 8. Version minimale

- B3 (le seed), F1, F2 et F3.
- F4 sans atténuation de la scène 3D.
- F6.

B1 et F5 peuvent attendre le PLAN-02. Sans B1, les inscriptions restent toujours ouvertes.

## 9. Risques

- **Fichier de verrouillage des dépendances :** voir F1. À régler avant que d'autres ajoutent des dépendances.
- **JWT dans `localStorage` :** il serait exposé en cas de faille XSS. C'est acceptable pour le hackathon. Ne jamais insérer de HTML saisi par un utilisateur, et passer plus tard à un cookie `httpOnly`.
- **Performance :** la scène 3D continue de tourner derrière la console. À mesurer sur un portable moyen ; si besoin, figer la scène en ne rendant une image qu'à la demande.
