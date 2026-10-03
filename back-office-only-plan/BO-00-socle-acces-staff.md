# BO-00 : socle du back-office et accès du personnel

> **Rôle :** Agent et Admin.
> **Réfs :** aucune en propre. Ce plan pose la garde de rôle exigée par D08 et D09, dont les critères sont dans le BO-04. Il pose aussi l'espace de travail distinct exigé par D19, dont les critères sont dans le BO-02.
> **Dépend de :** la branche `plan-00` (commit `bfd78b4`).
> **Débloque :** tous les autres plans BO.
> **Effort :** ≈ 3 h.

## 1. Objectif

Faire du back-office une application réelle :
- seul le personnel y entre, avec sa vraie identité ;
- chaque écran peut appeler l'API selon des conventions communes.

Aucun écran métier n'est branché ici, sauf la page Paramètres, déjà faite sur `plan-00`.

## 2. État actuel

| Zone | Sur `main` | Sur `plan-00` |
|---|---|---|
| Couche API | Absente (`src/api/` n'existe pas) | `client`, `session`, `errors`, `queryClient`, `types`, `settings`, `auth` |
| Identité | `layout/persona.ts` : l'espace dépend de l'URL, l'acteur est Alex ou Ada (`PERSONA_USER`) | Inchangé |
| Accès | `/agent/*` et `/admin/*` ouverts à tous | Inchangé. `BackofficeApp` affiche un toast quand la session expire |
| Barre du haut | Puce « Démo », cloche simulée, menu persona de démonstration | Inchangé |
| Palette ⌘K | Lit `requestStore`, propose « Passer à l'espace agent/admin » | Inchangé |
| Formulaires | `Field` en render-prop, sans erreur | `Field` avec `error`, `ErrorSummary`, `useApiForm` |
| Paramètres | Simulés (`configStore`) | Branchés sur `GET/PATCH /api/settings` |
| Seed | Minimal | Scénario des maquettes (`prisma/demoScenario.ts`) |

## 3. Décisions

| # | Décision | Pourquoi |
|---|---|---|
| D-1 | **Fusionner `plan-00` dans `main` avant tout autre travail sur le back-office.** | Tous les plans BO s'appuient sur `src/api/`, sur la session et sur `useApiForm`. Conflit attendu sur `project-plan/02-…md` et `project-plan/README.md`, modifiés des deux côtés : garder les deux contenus. |
| D-2 | **La connexion du personnel utilise le même `POST /api/auth/login`** que l'espace citoyen, avec une page propre au back-office. | Une seule session JWT (`nova-auth`). Le rôle renvoyé décide de l'espace. |
| D-3 | **L'espace dépend du rôle, plus seulement de l'URL.** | Un agent n'entre jamais dans `/admin`. Un admin peut ouvrir `/agent`, puisque le serveur lui accorde les droits du personnel : c'est « Vue agent ». |
| D-4 | **Une fonction simulée devient un hook de mutation**, toujours sur le même modèle (§ 5.4). | Le branchement de chaque plan reste mécanique et relisible. |
| D-5 | **La puce « Démo » quitte la barre du haut.** Chaque écran pas encore branché affiche « Données simulées » dans son en-tête. | Pendant la transition, on sait toujours ce qui est réel. |

## 4. Backend

Rien de nouveau. À vérifier après la fusion :
- `npx prisma migrate deploy` (migration `20261003210000_platform_settings`), puis `npm run seed` ;
- `GET /api/me` renvoie bien le rôle ;
- `requireStaff` accepte `AGENT` et `ADMIN`, `requireAdmin` seulement `ADMIN`.

## 5. Front

### 5.1 Page de connexion : `layout/StaffLoginPage.tsx`

**Routes et style**
- Routes `/agent/connexion` et `/admin/connexion`, hors du `Shell`.
- Style du back-office : `HudBackground`, un `Panel` centré, logo.

**Formulaire et erreurs**
- Champs e-mail et mot de passe, avec `Field`, `ErrorSummary` et `useApiForm`.
- `401 INVALID_CREDENTIALS` : « Identifiants incorrects. Il reste N essais. »
- `429 ACCOUNT_LOCKED` ou `IP_BLOCKED` : message clair et compte à rebours tiré de `Retry-After`. C'est la protection F37, rendue visible.

**Selon le rôle renvoyé**
- `CITIZEN` : pas de session ouverte dans le back-office. Afficher « Cet espace est réservé au personnel municipal », avec un lien vers `/ville`.
- `AGENT` ou `ADMIN` : `signIn()`, puis `BootSequence` avec le vrai prénom et le vrai rôle, puis retour vers `?retour=`, ou vers l'accueil de l'espace.

**Prévoir la suite**
- Le composant est une petite machine à états : `identifiants → (vérification) → connecté`.
- Le BO-05 y ajoute l'étape de double vérification (F53) et la connexion par clé d'accès (D02).

### 5.2 Gardes dans `BackofficeApp`

| Situation | Comportement |
|---|---|
| Pas de session | Redirection vers `/<espace>/connexion?retour=<url>` |
| Session `CITIZEN` | Écran « Espace réservé au personnel municipal » et lien vers `/ville`. Rien du back-office n'est rendu. |
| `AGENT` sur `/admin/*` | Redirection vers `/agent`, avec le toast « Réservé aux administrateurs » |
| Session expirée (`nova:session-expired`) | Redirection vers la connexion, avec le message « Session expirée : reconnectez-vous. » |

Ces gardes servent l'interface. La vraie protection est celle du serveur, qui répond `401` ou `403` : on ne compte jamais sur un bouton caché.

### 5.3 Identité réelle

- **`layout/persona.ts` :**
  - `useActor()` renvoie `useSessionUser()` ;
  - `PERSONA_USER` disparaît ;
  - `usePersona()` garde l'espace tiré de l'URL, que les gardes ont déjà validé.
- **Barre du haut :**
  - nom et rôle réels ;
  - menu profil : « Mon compte » (page du BO-05, en attendant un simple résumé), « Voir l'espace citoyen », « Se déconnecter » (`signOut()`, puis retour à la connexion) ;
  - le bloc « Persona de démonstration » devient « Vue agent / Vue admin », affiché seulement aux admins.
- **`BootSequence` :** « Liaison établie · \<prénom\>, \<rôle\> ».
- **Écrans :** chaque `useActor().id` utilisé pour signer une action simulée disparaît au branchement, car le serveur connaît l'auteur grâce au token.

### 5.4 Conventions de données

**Lecture**
- Un hook TanStack Query de `src/api/<domaine>.ts`.
- Les filtres et la page vivent dans l'URL (`useSearchParams`), pour qu'un lien partagé ouvre la même vue.
- La pagination et le tri sont faits par le serveur.

**États d'écran**

| Situation | Affichage |
|---|---|
| Chargement | `Skeleton` |
| Erreur | `EmptyState` « Impossible de charger … » avec un bouton « Réessayer » (`refetch`) |
| Liste vide | `EmptyState` du design, inchangé |

**Écriture**

```ts
// Avant : changeStatus(id, to, actor.id, note)
const update = useUpdateRequest()
update.mutate(
  { id, status: to, note },
  {
    onSuccess: () => toast(`${reference} → ${STATUS_LABEL[to]}`),
    onError: (error) => toast(messageFor(toApiError(error)), 'alert'),
  },
)
```

- **Le toast :** il s'affiche après la réponse du serveur, jamais avant.
- **Mise à jour optimiste :** elle est réservée aux bascules simples (étoile, actif), avec retour en arrière en cas d'erreur, sur le modèle de `useUpdateSettings`.
- **Action destructrice** (supprimer, désactiver, couper un service) : `Modal` de confirmation qui nomme l'objet.
- **Formulaires :** `Field`, `ErrorSummary` et `useApiForm`. Les erreurs de validation renvoyées par le serveur vont sur les champs.

**Codes d'erreur à traduire** dans `messageFor`, en plus de ceux du PLAN-00 :

| Code | Message |
|---|---|
| `FORBIDDEN` | « Action réservée aux administrateurs. » |
| `NOT_FOUND` | « Cet élément n'existe plus. » |
| `CONFLICT` | « Cette valeur est déjà utilisée. » Le backend renvoie aussi ce code pour un doublon Prisma (P2002). Un écran qui connaît mieux la cause (créneau complet, e-mail déjà pris) affiche son propre message. |

**Rafraîchissement :** les intervalles sont ceux du PLAN-00 (`queryClient.ts`), en pause quand l'onglet est caché.

### 5.5 Éléments du Shell sur données réelles

| Élément | Donnée | Quand |
|---|---|---|
| Cloche | `GET /api/notifications/unread-count` (30 s) et `GET /api/notifications?limit=8`. Ouvrir une notification → `PATCH /:id/read`. « Tout marquer comme lu » → `POST /read-all`. Le personnel reçoit déjà les messages des habitants sur ses demandes (`REQUEST_MESSAGE`). | Ici |
| Badges du menu (`useBadges`) | Un hook par compteur : `awaiting` (BO-01), `appointmentsToday` (BO-08), `activeAlerts` (BO-07), `interruptions` (BO-06) | Chaque badge bascule avec son plan. Avant, il est masqué : jamais de chiffre simulé à côté d'un chiffre réel. |
| Palette ⌘K | Navigation filtrée selon le rôle. Recherche des demandes par `GET /api/requests?q=&limit=5`, avec un délai de frappe de 250 ms. | Navigation ici, recherche avec le BO-01 |
| Puce « Démo » | Supprimée de `Topbar`. Nouvelle prop `simulated` de `PageHeader`, qui affiche « Données simulées ». | Ici. On la retire de chaque écran au moment de son branchement. |

### 5.6 Types

- Chaque plan ajoute ses contrats dans `src/api/types.ts`. Les écrans importent ces types au lieu de `mocks/types.ts`.
- À la fin, `mocks/types.ts` ne sert plus qu'à `TranslationsPage`, qui reste simulée (multilingue exclu).

## 6. Étapes

- [ ] Fusionner `plan-00` dans `main`, régler les conflits de `project-plan/`, puis `migrate deploy` et `seed`
- [ ] `StaffLoginPage` et ses routes `/agent/connexion`, `/admin/connexion`
- [ ] Gardes `RequireStaff` et `RequireAdmin`, redirection en cas d'expiration de session
- [ ] `useActor()` sur la session, menu profil, déconnexion, « Vue agent / Vue admin » réservé aux admins
- [ ] Cloche branchée sur les notifications
- [ ] `useBadges` découpé en un hook par compteur, compteurs masqués tant qu'ils ne sont pas branchés
- [ ] Palette : navigation selon le rôle, suppression de la bascule de persona pour les agents
- [ ] Prop `simulated` de `PageHeader`, posée sur tous les écrans encore simulés ; puce « Démo » supprimée
- [ ] `messageFor` : codes `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`
- [ ] `CLAUDE.md` : décrire le back-office branché (connexion, gardes, conventions)

## 7. Critères de sortie

1. Sans session, `/agent/demandes` mène à `/agent/connexion`. Après connexion avec `agent@`, on revient sur `/agent/demandes`.
2. Avec `citoyen@`, le back-office refuse l'accès, avec un lien vers `/ville`.
3. `agent@` sur `/admin` est renvoyé vers `/agent` avec un message. `admin@` ouvre `/admin` et `/agent`.
4. En supprimant le token du `localStorage` puis en naviguant, on revient à la connexion avec « Session expirée ».
5. La barre du haut affiche le vrai nom. La cloche affiche le vrai nombre de notifications non lues. « Se déconnecter » fonctionne.
6. La page Paramètres fonctionne toujours après la fusion : une modification survit au rechargement.
7. Chaque écran encore simulé affiche « Données simulées ».
8. Côté frontend, `npm run typecheck`, `npm run lint`, `npm run build` et `npm test` passent. Côté backend, `npm run typecheck` passe.

## 8. Version minimale

- La fusion de `plan-00`.
- La page de connexion.
- Les gardes.
- `useActor()` réel et la déconnexion.

La cloche, les badges et la palette peuvent attendre leurs plans.

## 9. Points d'attention

- **Une seule session pour tous les espaces :** un agent connecté qui ouvre `/ville` y est reconnu sous sa propre identité. C'est voulu (lien « Voir l'espace citoyen »).
- **`DevLogin`** (sur `plan-00`) ne doit être monté qu'en développement (`import.meta.env.DEV`).
- **Token dans le `localStorage` :** voir les risques du PLAN-00. Le BO-05 ajoute la révocation des sessions.
