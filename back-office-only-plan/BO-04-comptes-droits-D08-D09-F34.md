# BO-04 : comptes, citoyens et droits

> **Rôle :** Agent (fiches citoyens) et Admin (utilisateurs, rôles).
> **Réfs :** D08 · D09 · F34. **XP :** 1 580.
> **Dépend de :** BO-00, qui fournit la connexion et les gardes.
> **Pendant citoyen :** PLAN-01 de `project-plan/`, dont ce plan reprend la section 5.
> **Effort :** ≈ 3 h.

## 1. Pourquoi ces réfs vont ensemble

Les trois demandes portent sur **les profils, ce que chacun a le droit de faire, et l'administration des comptes**. Elles se traitent dans les écrans Utilisateurs, Rôles et Citoyens.

| Réf | Demandeur | Besoin | Ce que le back-office doit montrer |
|---|---|---|---|
| D08 | Direction des Services Municipaux | Distinguer clairement citoyens, agents et administrateurs, et adapter les outils de chacun | Les deux espaces (BO-00), les onglets par rôle des Utilisateurs, et la matrice des rôles qui dit qui peut quoi |
| D09 | Direction des Services Municipaux | Un citoyen n'atteint pas les outils des agents ; les fonctions sensibles restent limitées aux profils autorisés | Le refus côté interface (BO-00) **et** côté serveur, et les actions sensibles marquées comme telles dans la matrice |
| F34 | Direction du Numérique | Les agents administrent les comptes citoyens, sans qu'une personne non autorisée puisse accéder à un espace | La fiche citoyen de l'agent : modifier le profil, débloquer, désactiver avec un motif. Ni l'e-mail, ni le mot de passe, ni le rôle ne sont modifiables par un agent. |

## 2. Écrans et état actuel

| Écran | Route | Rôle | Aujourd'hui |
|---|---|---|---|
| `UsersPage` | `/admin/utilisateurs` | Admin | `userStore` : `setActive`, `unlockLogin`, `changeRole`, `updateProfile`, `createStaff` |
| `RolesPage` | `/admin/roles` | Admin | `configStore.togglePermission`, `mocks/config` (`PERMISSIONS`, `ROLE_PERMISSIONS`) |
| `CitizensPage` | `/agent/citoyens` | Agent | `userStore`, `requestStore`, `appointmentStore` |
| `shared/CitizenCard` | — | — | `mocks/config`, `mocks/types` |

**Backend prêt :**
- `GET /api/users?role=&q=&is_active=&district_id=&page=`, `GET /api/users/:id`, `PATCH /api/users/:id`, `POST /api/users/:id/unlock-login` et `DELETE /api/users/:id`, pour le personnel.
- `POST /api/users`, réservé aux admins.
- **Ce qu'un agent peut faire** (`user.controller.ts`) :
  - il ne voit que les comptes `CITIZEN` ; un autre compte lui renvoie `404` ;
  - un `PATCH` qui contient `email`, `password` ou `role` est refusé.
- **Garde-fou admin :** un admin ne peut ni se retirer son propre rôle, ni se désactiver.

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| Liste du personnel pour l'assignation (BO-01) | `GET /api/users/staff`, réservé au personnel : `id`, `name`, `last_name` et `role` des comptes AGENT et ADMIN actifs |
| L'état « verrouillé » n'est pas exposé | Ajouter `login_locked` et `locked_until` aux réponses de `/api/users`, calculés par `lib/loginGuard.ts` |
| Motif de désactivation, exigé pour la traçabilité | `PATCH { is_active: false, reason }` : `reason` est obligatoire pour une désactivation et part dans `metadata` de l'audit (BO-03) |
| Compter les comptes par rôle | `GET /api/users/stats`, réservé aux admins : `{ by_role, active, inactive, locked }` |
| La matrice des droits n'existe que dans le front simulé | `src/lib/permissions.ts` côté backend décrit, pour chaque permission : son libellé, les rôles qui l'ont, si elle est sensible, et les routes qui l'appliquent. `GET /api/permissions` la renvoie, réservé au personnel. Les middlewares ne changent pas : la matrice **documente** ce que `requireStaff`, `requireAdmin` et les contrôleurs appliquent, et un test simple vérifie qu'elle reste à jour (voir § 7). |

## 4. Branchement écran par écran

Fichiers front : `src/api/users.ts` (`useUsers`, `useUser`, `useStaff`, `useUserStats`, `useUpdateUser`, `useCreateUser`, `useUnlockUser`, `useDeleteUser`) et `src/api/permissions.ts`.

### 4.1 `UsersPage` (admin, D08, F34)

**Lecture**
- Les onglets Citoyens, Agents et Admins correspondent au paramètre `role`.
- Recherche, quartier et actif/inactif : paramètres `q`, `district_id` et `is_active`, gardés dans l'URL.
- Le compteur de chaque onglet vient de `GET /api/users/stats`.

**Actions**

| Fonction simulée | Appel |
|---|---|
| `setActive` | `PATCH { is_active, reason }`. La désactivation passe par une `Modal` avec un motif obligatoire. |
| `unlockLogin` | `POST /:id/unlock-login`. Le bouton n'apparaît que si `login_locked` est vrai. |
| `changeRole` | `PATCH { role }`. Confirmation obligatoire, car passer en ADMIN est sensible. |
| `updateProfile` | `PATCH { phone, address, district_id, is_vulnerable }` |
| `createStaff` | `POST /api/users { name, last_name, email, role, password }`. Le mot de passe provisoire est généré dans le navigateur, affiché **une seule fois**, avec un bouton « Copier » et la mention « à changer à la première connexion ». |
| Supprimer | `DELETE /:id`, après confirmation. Le nom du compte doit être retapé. |

**Erreurs à afficher**
- `409` : « Cet e-mail est déjà utilisé ».
- Refus de modifier son propre rôle : le message du serveur.

**Tiroir d'un compte :** onglet « Historique » (BO-03). Onglet « Sécurité » : appareils, double vérification et clés d'accès, ajoutés par le BO-05.

### 4.2 `CitizensPage` (agent, F34)

**Lecture**
- `GET /api/users?q=`. Le serveur limite déjà la liste aux citoyens.
- Fiche : `GET /api/users/:id`.
- Ses demandes : `GET /api/requests?citizen_id=` (BO-01).
- Ses rendez-vous : `GET /api/appointments?citizen_id=` (BO-08).

**Actions**
- Modifier la fiche : `PATCH`, uniquement sur `phone`, `address`, `district_id` et `is_vulnerable`.
  - L'e-mail et le rôle sont affichés en lecture seule, avec la mention « Modifiable uniquement par un administrateur ».
  - Le mot de passe n'apparaît nulle part.
- Débloquer la connexion : `POST /:id/unlock-login`.
- Désactiver ou réactiver : `PATCH { is_active, reason }`, avec un motif obligatoire.
- **Pourquoi on le montre :** « personne non autorisée n'accède à son espace » (F34). L'agent corrige un profil sans jamais pouvoir prendre la main sur le compte.

**Personne vulnérable :** la case `is_vulnerable` explique qu'elle fait recevoir les alertes destinées aux personnes vulnérables (F31, BO-07).

### 4.3 `RolesPage` (admin, D08, D09)

**Lecture**
- `GET /api/permissions`.
- Nombre de comptes par rôle : `GET /api/users/stats`.

**Affichage**
- Matrice rôles × permissions, **en lecture seule**. Les bascules simulées disparaissent.
- Chaque permission sensible porte une icône cadenas et l'étiquette « Sensible ».
- Mention en tête : « Les droits sont appliqués par le serveur. Ce tableau les décrit, il ne les modifie pas. »

**Encart « Vérifier un droit » (D09) :** pour une permission choisie, il montre les routes qui l'appliquent et la réponse attendue pour chaque rôle. Par exemple : `POST /api/users` → Citoyen 403, Agent 403, Admin 201. **Bouton « Tester maintenant » (4 oct. 2026) :** sonde les GET sans paramètre avec la session courante et affiche le statut HTTP réel à côté de la prédiction (preuve perceptible D09).

## 5. Nettoyage

Sont supprimés :
- `stores/userStore.ts` ;
- `configStore.togglePermission`, ainsi que `PERMISSIONS` et `ROLE_PERMISSIONS` de `mocks/config.ts` ;
- `mocks/people.ts`, quand plus aucun écran ne le lit (`DistrictMap` lit alors les quartiers depuis `GET /api/districts`).

## 6. Étapes

- [x] Backend :
  - [x] `GET /api/users/staff` et `GET /api/users/stats` ;
  - [x] `login_locked` et `locked_until` ;
  - [x] `reason` obligatoire pour désactiver ;
  - [x] `lib/permissions.ts` et `GET /api/permissions`.
- [x] `src/api/users.ts`, `src/api/permissions.ts`, `src/api/districts.ts`
- [x] `UsersPage` : onglets, filtres, tiroir, création du personnel avec mot de passe provisoire, désactivation avec motif, suppression
- [ ] `CitizensPage` : fiche, demandes, champs autorisés, déblocage faits ; rendez-vous au BO-08
- [x] `RolesPage` en lecture seule, avec l'encart « Vérifier un droit » et le test live « Tester maintenant »
- [ ] Nettoyage : partiel, `userStore` et `mocks/people` restent pour les écrans du BO-07 et du BO-08

## 7. Critères d'acceptation

1. **D08.**
   - `citoyen@` arrive sur `/ville`, `agent@` sur `/agent`, `admin@` sur `/admin`.
   - Le menu de l'agent ne contient ni Utilisateurs, ni Rôles, ni Audit.
2. **D09.**
   - Avec un token d'agent, `curl -X POST /api/users` répond `403`, et `PATCH /api/users/<id citoyen> { "role": "ADMIN" }` est refusé.
   - Avec un token de citoyen, `GET /api/requests` ne renvoie que ses propres demandes.
   - La matrice des rôles affiche ces refus.
3. **F34.**
   - `agent@` retrouve un citoyen par son nom, corrige son téléphone, puis débloque son compte verrouillé après 5 échecs de connexion.
   - L'e-mail n'est pas modifiable.
   - La désactivation exige un motif, que l'on retrouve dans l'audit.
4. **Comptes du personnel.**
   - `admin@` crée un compte agent : le mot de passe provisoire s'affiche une seule fois.
   - Le nouvel agent se connecte avec ce mot de passe et apparaît dans la liste d'assignation (BO-01).
5. **Matrice à jour.** Un test backend (`npm run typecheck`, plus un script `scripts/check-permissions.ts`) échoue si une route `requireAdmin` n'est pas déclarée dans `lib/permissions.ts`.

## 8. Version minimale

À faire en premier :
- `GET /api/users/staff` ;
- `UsersPage` : lecture, activation, déblocage, création ;
- `CitizensPage` : lecture et modification.

Peut attendre :
- `RolesPage` reste en lecture seule sur la matrice du front, avec un avertissement ;
- le script de contrôle de la matrice ;
- la suppression de comptes.

## 9. Points d'attention

- **Compte supprimé par l'habitant (F33) :** ses demandes restent, avec `citizen_id` nul (`onDelete: SetNull`). Le détail d'une demande affiche alors « Compte supprimé » au lieu d'une fiche vide.
- **Mot de passe provisoire :** il n'existe pas encore de changement de mot de passe forcé. Le BO-05 peut l'ajouter (`must_change_password`). En attendant, la mention suffit.

## Réalisé (4 octobre 2026)

- **Backend :** `GET /api/users/stats`, `login_locked` / `locked_until` (calculés par `lockState`), motif obligatoire pour désactiver (`reason`, gardé dans l'audit), `lib/permissions.ts` + `GET /api/permissions`, `npm run check:permissions` (`scripts/check-permissions.ts` lit les routeurs).
- **Écrans :** `shared/AccountDrawer` commun à `UsersPage` et `CitizensPage` (onglets Profil, Sécurité pour l'admin, Historique), création du personnel avec mot de passe provisoire affiché une fois, `RolesPage` en lecture seule avec « Vérifier un droit » et test live HTTP.
- **Nettoyage partiel :** `togglePermission`, `PERMISSIONS` et `ROLE_PERMISSIONS` sont supprimés. `stores/userStore.ts` et `mocks/people.ts` restent, réduits à la liste des comptes, car `lib/lookups` les lit encore pour les écrans du BO-07 et du BO-08.
- **Pas fait :** les rendez-vous d'un habitant dans sa fiche (BO-08) ; `must_change_password`.
- **Vérifié dans Chrome :** critères 2 à 5 (le 1 relève du sas citoyen, PLAN-01).
- **Protection perceptible (4 oct. 2026, avec PLAN-01 / F37) :** spec `docs/superpowers/specs/2026-10-04-admin-data-protection-design.md` — test live RolesPage, historique interruptions `scope=all` staff-only, bannière F37 sur Mon espace, badge « Données simulées · navigateur seulement » sur BO-07/08.
- **Matrice éditable (4 oct. 2026) :** Agent/Admin cochables (`PATCH /api/permissions/:key`, `requirePermission`, overrides `role_grants`) ; Citoyen verrouillé ; `permissions.manage` et `staff.manage` non retirables à Admin. Spec : `docs/superpowers/specs/2026-10-04-editable-role-matrix-design.md`.

## Complément F34 (4 octobre 2026)

- **Faille fermée :** `GET /api/auth/by-email` ouvrait une session sur n'importe quel compte avec son seul e-mail (la reconnaissance faciale se faisait dans le navigateur). Remplacé par `POST /api/auth/face`, où l'API fait vérifier le visage par le moteur (`/verify`, clé côté serveur). L'enrôlement d'un visage passe par `POST /api/me/face`, pour son propre compte, une fois le compte créé.
- **Retrouver l'accès :** dans la fiche (`shared/AccessRecovery`), l'agent vérifie l'identité (pièce d'identité, personne connue, questions par téléphone), puis remet un code à usage unique de 30 min. La personne choisit elle-même son mot de passe dans le sas (« Code oublié ? J'ai un code de la mairie »). Ses autres appareils sont déconnectés.
- **Garde-fous :** la suppression d'un compte est réservée aux admins (l'agent désactive) ; la personne est notifiée de chaque action de la mairie sur son compte ; un compte suspendu reçoit un message clair (`ACCOUNT_DISABLED`).
- **Vérifié :** 17 scénarios contre l'API (dont visage d'un tiers, code réutilisé, agent qui tente de fixer un mot de passe ou de supprimer), et le parcours complet dans Chrome.

