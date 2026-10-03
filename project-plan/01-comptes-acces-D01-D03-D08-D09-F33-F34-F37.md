# PLAN-01 : comptes, connexion et rôles

> **Réfs :** D01 · D03 · D08 · D09 · F33 · F34 · F37. **XP :** 3 270.
> **Dépend de :** PLAN-00. **Débloque :** tous les écrans authentifiés et le PLAN-09.
> **Effort :** ≈ 5 h (backend 0,5 h, citoyen 2,5 h, back-office 2 h).

## 1. Pourquoi ces demandes vont ensemble

Ces sept demandes décrivent la vie d'un compte, du début à la fin :

1. on le crée (D01) ;
2. on s'y reconnecte (D03) ;
3. le système sait qui l'on est (D08) et ce qu'on a le droit de faire (D09) ;
4. un agent peut l'administrer (F34) ;
5. il est protégé contre les attaques (F37) ;
6. on peut le supprimer (F33).

Elles partagent la même session, les mêmes endpoints `/auth`, `/me` et `/users`, et les mêmes gardes de route.

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| D01 | Haut Conseil | Un nouvel habitant crée simplement son compte | Inscription en moins d'une minute, puis arrivée dans son espace |
| D03 | Direction des Services Municipaux | Revenir sans tout recommencer et retrouver son espace | Connexion vers « Mon espace », avec ses demandes et ses rendez-vous |
| D08 | Direction des Services Municipaux | Distinguer citoyens, agents et administrateurs | Trois profils, trois interfaces |
| D09 | Direction des Services Municipaux | Un citoyen n'atteint pas les outils des agents | Gardes côté front, et refus `403` de l'API vérifiable |
| F33 | Service des Usagers | Supprimer son compte sans qu'un tiers puisse le faire | Mot de passe redemandé et confirmation explicite |
| F34 | Direction du Numérique | Les agents administrent les comptes citoyens | Fiche citoyen modifiable, sans accès aux identifiants |
| F37 | Centre de cybersécurité | Une protection visible contre les tentatives de connexion répétées | Compteur d'essais, blocage temporaire, alerte au titulaire, vue admin |

## 2. Existant

**Backend, prêt :**

- Endpoints :
  - authentification : `POST /api/auth/register`, `POST /api/auth/login` ;
  - compte connecté : `GET/PATCH /api/me`, `PATCH /api/me/password`, `DELETE /api/me` avec `{ password, confirm: true }` ;
  - administration : `GET/POST/PATCH/DELETE /api/users`, `POST /api/users/:id/unlock-login` ;
  - sécurité : `GET /api/security/overview`, `GET /api/security/login-attempts`.
- **Blocage :**
  - un e-mail est bloqué après 5 échecs en 15 min ; une IP après 20 ;
  - chaque échec répond `401 INVALID_CREDENTIALS` avec `remaining_attempts` ;
  - une fois bloqué : `429 ACCOUNT_LOCKED` ou `IP_BLOCKED`, avec `Retry-After` ;
  - le titulaire reçoit une notification `SECURITY` ;
  - la réponse de connexion contient `security.failed_attempts_since_last_login`.
- **Agents (F34) :** ils ne voient que les citoyens et ne peuvent modifier ni l'e-mail, ni le mot de passe, ni le rôle. C'est contrôlé dans `user.controller.ts`.
- **Suppression d'un compte par son titulaire (F33) :**
  - les demandes sont conservées mais détachées de la personne ;
  - les rendez-vous à venir sont annulés ;
  - les notifications sont supprimées.

**Front citoyen :**

- Le sas demande un identifiant et un code de démonstration (`features/auth/demoAuthService`).
- Le blocage est calculé dans le navigateur (`accessLock.ts`).
- Les rôles `resident` et `council` sont fictifs.
- Il n'y a ni inscription ni espace personnel.

**Back-office :**

- La persona dépend de l'URL (`layout/persona.ts`) et les routes ne sont pas protégées.
- Les pages Utilisateurs, Citoyens et Rôles sont simulées.
- Il n'y a pas de page Sécurité.

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| Les agents ne peuvent pas lister le personnel, car le filtre `role` est forcé à `CITIZEN`. Ils en ont besoin pour assigner une demande (PLAN-03). | `GET /api/users/staff` (personnel uniquement), qui ne renvoie que `id, name, last_name, role, is_active`. |
| Inscriptions fermables avec le paramètre `registration_open` (PLAN-00, B1). | **Fait au PLAN-00** : `auth.controller.register` répond `403 REGISTRATION_CLOSED`. |
| La création d'un compte agent (`POST /api/users`) exige un mot de passe. | Aucun changement backend : le formulaire admin génère un mot de passe provisoire, affiché une seule fois. Extension possible : `must_change_password`. |
| La matrice des droits (page Rôles) n'existe pas en base : les droits sont codés dans `middleware/auth.ts` et dans les contrôleurs. | Pas de table. Un fichier statique `frontend/src/api/permissions.ts` décrit la matrice ; chaque ligne y est commentée avec la règle serveur qu'elle reflète. |

## 4. Front citoyen

### 4.1 Connexion (D03, F37), dans `features/auth/`

**Formulaire :**
- `AccessHologram` affiche les champs « Adresse e-mail » (`type=email`, `autocomplete=username`) et « Mot de passe » (`autocomplete=current-password`).
- Un bouton permet d'afficher ou de masquer le mot de passe.
- L'envoi appelle `POST /api/auth/login`.

**Blocage géré par le serveur :** `accessLock.ts` et son test sont supprimés.
- Sur `401 INVALID_CREDENTIALS`, afficher « E-mail ou mot de passe incorrect. Encore N essai(s) avant un blocage de 15 minutes. »
- Sur `429 ACCOUNT_LOCKED` ou `IP_BLOCKED` :
  - afficher un compte à rebours basé sur `Retry-After` et désactiver le bouton ;
  - expliquer : « Par sécurité, ce compte est bloqué temporairement. Son titulaire a été prévenu. » ;
  - proposer un lien « Écrire à la mairie », qui fonctionne sans compte (D04, PLAN-03).

**Comptes de démonstration :**
- Les boutons restent, pour le jury, mais remplissent désormais les comptes du seed : `citoyen@`, `senior@`, `agent@` et `admin@novaterra.local`, avec le mot de passe du seed.
- On peut les masquer avec `VITE_DEMO_ACCOUNTS=false`.

**Après la connexion :**
- `CITIZEN` : le film continue vers `/ville` (comportement actuel), ou vers l'adresse indiquée par `?retour=`.
- `AGENT` ou `ADMIN` : envoi direct vers `/agent` ou `/admin`, sans descente cinématique.
- Si `security.failed_attempts_since_last_login > 0`, « Mon espace » affiche : « 3 tentatives de connexion ont échoué depuis votre dernière visite. Si ce n'était pas vous, changez votre mot de passe. » C'est ce qui rend F37 visible pour l'habitant.

**Session :**
- `authStore` est remplacé par `api/session`.
- La session contient l'utilisateur renvoyé par l'API : `name`, `role`, `district`, etc. Le libellé du rôle en est déduit : « Habitant·e », « Agent », « Administrateur ».
- Le bouton pour quitter la ville (`CityPage.quit`) appelle `signOut()` et `queryClient.clear()`.

### 4.2 Inscription (D01), route `/inscription`

Elle est placée dans `FilmLayout`, avec le même décor que le sas.

- Lien « Nouvel habitant ? Créer mon compte » sous le formulaire de connexion.
- Trois étapes courtes, avec l'indication « Étape 2 sur 3 » :
  1. prénom, nom, e-mail ;
  2. quartier (liste issue de `GET /api/districts`, facultatif) et téléphone (facultatif). Une case à cocher « Je souhaite être prévenu·e en priorité en cas d'alerte sanitaire (personne vulnérable) », accompagnée d'une explication. Elle sert F31 ;
  3. mot de passe et confirmation. Les règles de `zPassword` sont écrites en clair et vérifiées pendant la saisie.
- L'envoi appelle `POST /api/auth/register`. La session s'ouvre, puis l'habitant arrive sur l'accueil guidé (PLAN-09) s'il est livré, sinon sur `/ville`.
- **Erreurs :**
  - sur `409 CONFLICT`, afficher « Un compte existe déjà avec cet e-mail. Se connecter ? » ;
  - sur `403 REGISTRATION_CLOSED`, afficher un message et le contact de la mairie.

### 4.3 Mon espace (D03), route `/ville/espace`

- En-tête : « Bonjour Miora », avec le quartier.
- Des cartes, alimentées par le bloc `me` de `GET /api/home` puis par les plans suivants :
  - demandes en cours (PLAN-03) ;
  - prochain rendez-vous (PLAN-05) ;
  - notifications non lues (PLAN-04) ;
  - sécurité (voir F37 au § 4.1) ;
  - progression de l'accueil guidé (PLAN-09).
- Un lien « Mon espace » dans la `TopBar`, avec un badge qui compte les demandes attendant une action de l'habitant.

### 4.4 Profil et suppression du compte (D03, F33), route `/ville/espace/profil`

- **Informations personnelles :** prénom, nom, téléphone, adresse, quartier, personne vulnérable, enregistrés par `PATCH /api/me`.
- **Mot de passe :** ancien, nouveau et confirmation, enregistrés par `PATCH /api/me/password`.
- **Préférences d'affichage :** un emplacement réservé au PLAN-08.
- **Zone « Supprimer mon compte » (F33) :**
  1. un texte clair explique les conséquences, celles décrites au § 2 ;
  2. une fenêtre de confirmation redemande le mot de passe et fait cocher « Je comprends que cette action est définitive » ;
  3. l'appel `DELETE /api/me` ferme la session et ramène au sas avec le message « Votre compte a été supprimé. ».
  - Si le mot de passe est faux, l'erreur s'affiche dans le champ et l'habitant n'est pas déconnecté.
  - L'action n'apparaît pas pour un agent ou un admin, car le backend la réserve aux citoyens.

### 4.5 Contrôle d'accès (D08, D09)

- `RequireSession` protège `/ville/*`.
- Un agent ou un admin peut ouvrir l'espace citoyen. La `TopBar` lui propose alors un lien « Retour à mon espace de travail ».
- Le bouton de démonstration « Haut Conseil » de `ReportTracker` disparaît : les demandes se traitent dans le back-office (PLAN-03).

## 5. Back-office

### 5.1 Connexion et gardes (D08, D09)

**Page de connexion :**
- `backoffice/layout/StaffLoginPage.tsx`, au style du back-office : panneau HUD, puis `BootSequence` après la connexion.
- Routes `/agent/connexion` et `/admin/connexion`.

**Garde `RequireStaff` dans `BackofficeApp` :**
- sans session, redirection vers la page de connexion, avec `?retour=` ;
- pour un `CITIZEN`, écran « Espace réservé au personnel municipal » avec un lien vers `/ville` ;
- pour un `AGENT` sur `/admin/*`, redirection vers `/agent` et toast « Réservé aux administrateurs ».

**Persona :**
- Dans `layout/persona.ts`, `useActor()` renvoie l'utilisateur de la session, et `PERSONA_USER` disparaît.
- Le sélecteur de persona du menu profil n'est affiché qu'aux admins, pour basculer entre la vue Admin et la vue Agent.

**Barre du haut :** nom et rôle réels, « Se déconnecter », « Voir l'espace citoyen ».

### 5.2 Pages

| Page | Lecture | Actions (fonction simulée → endpoint) |
|---|---|---|
| `admin/pages/UsersPage.tsx` (D08, F34) | `GET /api/users?role=&q=&is_active=&district_id=&page=`. Les onglets Citoyens, Agents et Admins correspondent au paramètre `role`. | Voir le tableau « Actions de UsersPage » ci-dessous. |
| `agent/pages/CitizensPage.tsx` (F34) | `GET /api/users?q=`, que le backend limite aux citoyens, et `GET /api/users/:id` | Voir le tableau « Actions de CitizensPage » ci-dessous. |
| `admin/pages/RolesPage.tsx` (D08) | Matrice statique de `src/api/permissions.ts`. Nombre de comptes par rôle : `meta.total` de `GET /api/users?role=…&limit=1`. | Les bascules sont retirées. La page passe en lecture seule, avec la mention « Les droits sont appliqués par le serveur ». |
| **Nouvelle** `admin/pages/SecurityPage.tsx` (F37), route `/admin/securite`, dans le menu « Comptes & droits » | `GET /api/security/overview`, rafraîchi toutes les 30 s, et `GET /api/security/login-attempts?email=&ip=&success=&page=` | Voir le tableau « Actions de SecurityPage » ci-dessous. |

**Actions de UsersPage :**

| Action | Appel |
|---|---|
| `setActive` | `PATCH /api/users/:id { is_active }` |
| `unlockLogin` | `POST /api/users/:id/unlock-login` |
| `changeRole` | `PATCH { role }` |
| `updateProfile` | `PATCH { phone, address, district_id, is_vulnerable }` |
| `createStaff` | `POST /api/users { name, last_name, email, role, password }`, avec un mot de passe provisoire généré et affiché une seule fois |
| Suppression | `DELETE /api/users/:id`, après confirmation |

**Actions de CitizensPage :**

| Action | Appel |
|---|---|
| Modifier la fiche | `PATCH /api/users/:id`, uniquement sur les champs autorisés aux agents. L'e-mail et le rôle sont en lecture seule, avec la mention « modifiable par un administrateur ». |
| Débloquer la connexion | `POST /api/users/:id/unlock-login` |
| Demandes du citoyen | Paramètre `citizen_id`, ajouté par le PLAN-03 |
| Rendez-vous du citoyen | Ajoutés par le PLAN-05 |

**Actions de SecurityPage :**

| Action | Appel |
|---|---|
| Débloquer un compte ciblé | `GET /api/users?q=<email>`, puis `POST /api/users/:id/unlock-login` |
| Filtrer les tentatives | Par e-mail, IP ou résultat |
| Aide au déploiement cPanel | Encart qui explique `TRUST_PROXY` et affiche le résultat de `GET /api/security/client-ip` |

Le fichier `stores/userStore.ts` et la fonction `configStore.togglePermission` sont supprimés.

## 6. Étapes

- [ ] Backend : `GET /api/users/staff` (le contrôle de `registration_open` est fait)
- [ ] `src/api/auth.ts` (déjà `login()`), `me.ts`, `users.ts`, `security.ts`, `permissions.ts` ; supprimer `src/dev/DevLogin.tsx` du panneau de la page Paramètres une fois `StaffLoginPage` en place
- [ ] Sas : connexion par l'API, blocage géré par le serveur, comptes de démonstration du seed, redirection selon le rôle ; suppression de `accessLock.ts`, `demoAuthService` et `demoAccounts.ts`
- [ ] Page `/inscription`
- [ ] `/ville/espace` et `/ville/espace/profil` (profil, mot de passe, suppression du compte)
- [ ] Back-office : `StaffLoginPage`, `RequireStaff`, vrai `useActor`, déconnexion
- [ ] `UsersPage`, `CitizensPage`, `RolesPage` en lecture seule, `SecurityPage` et son entrée de menu dans `nav.ts`
- [ ] Nettoyage des stores et mocks devenus inutiles

## 7. Critères d'acceptation (scénario de démo)

1. **D01.** Depuis le sas, « Créer mon compte », puis 3 étapes : on arrive dans la ville avec « Bonjour \<prénom\> ».
2. **D03.** Après une déconnexion puis une reconnexion, « Mon espace » montre les mêmes demandes et les mêmes rendez-vous.
3. **D08.** `citoyen@` arrive sur `/ville`, `agent@` sur `/agent`, `admin@` sur `/admin`. Chaque interface ne montre que ses outils.
4. **D09.**
   - Un citoyen connecté qui ouvre `/admin` voit l'écran « réservé au personnel ».
   - `curl -H "Authorization: Bearer <token citoyen>" …/api/users` répond `403`.
5. **F33.**
   - Avec le bon mot de passe, la suppression déconnecte l'habitant, et une nouvelle connexion est refusée.
   - Avec un mauvais mot de passe, un message d'erreur s'affiche et le compte reste intact.
6. **F34.**
   - L'agent corrige le téléphone et le quartier d'un citoyen.
   - Il ne peut changer ni l'e-mail ni le rôle : les champs sont en lecture seule, et l'API répond `403` si on force.
   - L'admin désactive un compte, puis le réactive.
7. **F37.**
   - Après 4 mauvais mots de passe, on lit « encore 1 essai ». Au 5ᵉ, le compte est bloqué et un compte à rebours s'affiche.
   - Le titulaire reçoit la notification de sécurité et voit « N tentatives échouées » à sa connexion suivante.
   - L'admin voit le compte ciblé dans la page Sécurité et le débloque.

## 8. Version minimale

À faire en premier :
- la connexion par l'API, la redirection selon le rôle et les gardes ;
- l'inscription, en une seule étape ;
- la suppression du compte ;
- `UsersPage`.

Peuvent attendre : la page Sécurité, le message sur les tentatives échouées et la `CitizensPage`.

## 9. Points d'attention

- **Mot de passe oublié :** aucun endpoint n'existe, faute de service d'envoi d'e-mails. Afficher « Contactez la mairie ». Un lien de réinitialisation est une extension possible.
- **Durée du blocage :** le blocage de démonstration du sas (30 s) est remplacé par celui du serveur (15 min). Pendant la démo au jury, garder une session admin ouverte pour pouvoir débloquer.
- **Mise en scène :** l'appel à l'API ne doit pas bloquer l'animation. Le bouton affiche « Vérification… » pendant l'appel ; la cinématique ne démarre qu'après une connexion réussie.
