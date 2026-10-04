# BO-05 : sécurité des connexions

> **Rôle :**
> - Admin : page Sécurité, fiches utilisateurs, politique.
> - Agent : lecture des événements de sécurité, sans IP, et déblocage.
> - Tout le personnel : sa page « Mon compte » et sa connexion.
>
> **Réfs :** D02 · F37 · F53 · F54 · F100. **XP :** 4 520.
> **Dépend de :** BO-00 (page de connexion), BO-04 (fiches utilisateurs), BO-03 (audit des actions de sécurité).
> **Pendant citoyen :** les parcours habitant de D02, F53 et F54 ne sont pas encore planifiés dans `project-plan/`. Ce plan écrit le backend commun et la partie back-office. Le front citoyen n'aura qu'à appeler les mêmes endpoints.
> **Effort :** ≈ 7 h. F37 ≈ 1 h, F54 ≈ 2 h, F53 ≈ 2,5 h, D02 ≈ 1,5 h.

## 1. Pourquoi ces réfs vont ensemble

Les quatre demandes protègent **le même moment : la connexion à un compte**. Dans le back-office, elles partagent :
- la page de connexion du personnel ;
- la page Sécurité de l'admin ;
- l'onglet Sécurité de la fiche utilisateur ;
- la page « Mon compte ».

| Réf | Demandeur | Besoin | Ce que le back-office doit montrer |
|---|---|---|---|
| F37 | Centre de cybersécurité | Contrer des tentatives de connexion inhabituelles, de façon visible, sans compliquer l'usage normal | La page Sécurité : tentatives, comptes bloqués, IP suspectes, déblocage. La page de connexion du personnel affiche les essais restants et le délai de blocage. |
| F54 | Citoyenne | Être prévenue d'une connexion depuis un nouvel appareil | Les appareils connus de chaque compte, la liste des nouvelles connexions des dernières 24 h, et la révocation des sessions |
| F53 | Service informatique | Une vérification supplémentaire, compréhensible et efficace | La double vérification par application (TOTP) : obligatoire pour le personnel si la politique l'exige, taux d'adoption, réinitialisation par un admin |
| D02 | Direction du Numérique | Se connecter sans mot de passe classique, avec un haut niveau de sécurité | Les clés d'accès (passkeys, WebAuthn) : connexion du personnel, gestion dans « Mon compte », révocation par un admin |
| F100 | Direction du Numérique | Les agents consultent les derniers événements de sécurité, faciles à retrouver pour le suivi quotidien | Page `/agent/securite` et encart du tableau de bord : flux fusionné (audit `security.*` + refus regroupés), sans IP |

## 2. État actuel

**Backend prêt (F37) :**
- `lib/loginGuard.ts` : 5 échecs en 15 min verrouillent un e-mail, 20 échecs bloquent une IP.
- `LoginAttempt` (e-mail, IP, user agent, résultat, motif).
- `GET /api/security/overview` (dernière heure, dernières 24 h, comptes verrouillés, IP les plus actives), `GET /api/security/login-attempts` et `GET /api/security/client-ip`.
- `POST /api/users/:id/unlock-login`.
- La réponse de connexion contient `security.failed_attempts_since_last_login`.

**Absent :** les appareils, la double vérification, les clés d'accès, la révocation des sessions.

**Back-office :** aucune page Sécurité ni « Mon compte ». Les paramètres de sécurité sont simulés (`login_max_failures` et `login_lock_minutes` dans `configStore`).

## 3. Backend

### 3.1 Révocation des sessions (prérequis de F54 et de D02)

- `User.token_version Int @default(0)`, inclus dans le JWT (`tv`).
- `authenticate` recharge déjà l'utilisateur à chaque requête. Il refuse le token si `tv` ne correspond pas : `401 SESSION_REVOKED`.
- Endpoints :
  - `POST /api/me/sessions/revoke`, pour soi-même : déconnecte tous les autres appareils, puis renvoie un nouveau token ;
  - `POST /api/users/:id/revoke-sessions`, réservé aux admins et audité.

### 3.2 Appareils (F54)

```prisma
// F54: devices a user has signed in from, to warn about new ones
model UserDevice {
  id           Int      @id @default(autoincrement())
  user_id      Int
  device_hash  String   @db.VarChar(64)   // sha256 de l'identifiant d'appareil envoyé par le navigateur
  label        String   @db.VarChar(120)  // « Chrome sur macOS », déduit du user agent
  first_seen   DateTime @default(now())
  last_seen    DateTime @default(now())
  last_ip      String?  @db.VarChar(64)

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, device_hash])
}
```

**Identifiant d'appareil**
- Le navigateur crée un identifiant aléatoire (`crypto.randomUUID()`) et le garde dans le `localStorage` (`nova-device`, avec try/catch).
- Il l'envoie dans l'en-tête `X-Device-Id` à chaque connexion. Sans identifiant, le serveur se rabat sur le hachage du user agent.

**À une connexion réussie**
- Appareil inconnu, et le compte a déjà au moins un appareil : création de l'appareil, puis notification `SECURITY` à l'utilisateur :
  > « Nouvelle connexion depuis Chrome sur macOS, le 3 oct. à 22:10. Ce n'était pas vous ? Déconnectez les autres appareils et changez votre mot de passe. »

  Le lien mène à « Mon compte ». L'événement est audité (`security.new_device`).
- Première connexion du compte : l'appareil est enregistré sans alerte.

**Endpoints**
- `GET /api/me/devices`, `DELETE /api/me/devices/:id` (« oublier »).
- `GET /api/users/:id/devices`, réservé aux admins.
- `GET /api/security/new-devices?hours=24`, réservé aux admins.

### 3.3 Double vérification (F53)

**Bibliothèques :** `otplib` (TOTP) et `qrcode` (QR code en data URL), côté backend.

**Schéma**
- Sur `User` : `two_factor_secret String?` et `two_factor_enabled_at DateTime?`.
- Nouveau modèle `TwoFactorRecoveryCode { id, user_id, code_hash, used_at }` : 8 codes de secours, hachés avec bcrypt.

**Activation**
- `POST /api/me/2fa/setup` renvoie `{ otpauth_url, qr_data_url }`. Le secret est stocké, mais pas encore actif.
- `POST /api/me/2fa/enable { code }` renvoie les codes de secours **une seule fois**.
- `POST /api/me/2fa/disable { password, code }`.

**Connexion en deux temps**
- Si la double vérification est active, `POST /api/auth/login` renvoie `200 { two_factor_required: true, challenge_token }`. Le jeton est un JWT de 5 min, avec `purpose: '2fa'`. Aucune session n'est ouverte à ce stade.
- `POST /api/auth/2fa/verify { challenge_token, code | recovery_code }` renvoie la réponse de connexion habituelle.
- Les échecs comptent dans `loginGuard`, comme des mots de passe faux.

**Politique**
- Nouvelle clé de `PlatformSetting` : `two_factor_required_roles`, par défaut `["ADMIN"]`.
- Un compte d'un rôle concerné qui n'a pas activé la double vérification reçoit, à la connexion, `{ two_factor_setup_required: true, setup_token }`. Le back-office impose alors l'activation avant tout accès.

**Côté admin**
- `POST /api/users/:id/2fa/reset`, réservé aux admins, audité. L'utilisateur est prévenu par une notification `SECURITY`.
- `GET /api/security/overview` ajoute `two_factor: { staff_enabled, staff_total, citizens_enabled }`.

### 3.4 Clés d'accès (D02)

**Bibliothèques :** `@simplewebauthn/server` côté backend, `@simplewebauthn/browser` côté frontend.

```prisma
// D02: passwordless sign-in with passkeys (WebAuthn)
model Passkey {
  id            Int       @id @default(autoincrement())
  user_id       Int
  credential_id String    @unique @db.VarChar(255)
  public_key    Bytes
  counter       Int       @default(0)
  transports    String?
  label         String    @db.VarChar(120)   // « MacBook de Ada »
  created_at    DateTime  @default(now())
  last_used_at  DateTime?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

**Endpoints**
- Enregistrement :
  - `POST /api/me/passkeys/register/options`, puis `POST /api/me/passkeys/register/verify { response, label }` ;
  - `GET /api/me/passkeys`, `DELETE /api/me/passkeys/:id`.
- Connexion :
  - `POST /api/auth/passkey/options { email? }`, puis `POST /api/auth/passkey/verify { response }`.
  - La vérification renvoie la réponse de connexion habituelle.
- Admin : `DELETE /api/users/:id/passkeys`, audité.

**Règles**
- Une clé d'accès exige la vérification de l'utilisateur (empreinte, code de l'appareil). Elle satisfait donc la politique de double vérification.
- Les connexions par clé passent aussi par `UserDevice` (F54) et par `LoginAttempt` (motif `PASSKEY`).
- La configuration se fait par variables d'environnement : `WEBAUTHN_RP_ID` (le domaine) et `WEBAUTHN_ORIGIN`.
- WebAuthn exige HTTPS, ce qui est le cas sur cPanel. `localhost` est accepté en développement.

### 3.5 Événements de sécurité (F100)

`GET /api/security/events?days=1..30&limit=1..100&kind=login|device|factor|account`, personnel. Deux sources fusionnées (audit `security.*` / `user.login_unlocked`, et `LoginAttempt` `LOCKED` / `IP_BLOCKED` / `DISABLED` regroupés par e-mail et motif), triées par date, coupées à `limit`. Un agent ne reçoit pas la clé `ip` ; un admin la reçoit seulement sur une ligne d'audit. Les compteurs (`refused_24h`, `locked_now`, `new_devices_24h`, `factor_changes_7d`) et `locked_accounts` ignorent les filtres. Les routes admin (`/overview`, tentatives, IP, nouveaux appareils) restent admin.

## 4. Back-office

Fichiers front :
- `src/api/security.ts` : vue d'ensemble, tentatives, nouveaux appareils, flux F100 ;
- `src/api/me.ts` : appareils, double vérification, clés d'accès, sessions ;
- `src/api/auth.ts` : vérification du code, connexion par clé.

### 4.1 Page de connexion du personnel (BO-00, étendue)

La machine à états du BO-00 gagne deux étapes et un bouton :

1. **Identifiants**, ou bien **« Se connecter avec une clé d'accès »** (D02), si le navigateur sait le faire (`browserSupportsWebAuthn()`).
2. **Code de vérification** (F53) : un champ de 6 chiffres (`inputmode="numeric"`, `autocomplete="one-time-code"`). Un lien « Utiliser un code de secours » permet de saisir un code de secours à la place.
3. **Activation obligatoire** : si la politique l'exige, un QR code s'affiche avec sa clé lisible (pour une saisie manuelle), puis le champ de code, puis les codes de secours à copier.

Les erreurs gardent les messages de F37 : essais restants, compte à rebours de blocage.

### 4.2 Nouvelle page `/admin/securite` (F37, F53, F54)

Elle s'ajoute dans le menu « Comptes & droits », avec les codes F37 · F53 · F54 · D02.

| Bloc | Lecture | Actions |
|---|---|---|
| Vue d'ensemble | `GET /api/security/overview`, toutes les 30 s : échecs et succès sur la dernière heure et les 24 h, comptes verrouillés, IP les plus actives | — |
| Comptes verrouillés | Dans la vue d'ensemble | « Débloquer » : `POST /api/users/:id/unlock-login` |
| Tentatives | `GET /api/security/login-attempts?email=&ip=&success=&page=` | Filtres gardés dans l'URL |
| Nouveaux appareils (24 h) | `GET /api/security/new-devices` | Ouvrir la fiche de l'utilisateur |
| Adoption de la double vérification | `overview.two_factor` : jauge du personnel (x / y), nombre de citoyens | Lien vers la politique, dans Paramètres |
| Aide au déploiement cPanel | `GET /api/security/client-ip` | Un encart explique `TRUST_PROXY` si l'IP vue n'est pas la bonne |

### 4.3 Fiche utilisateur, onglet « Sécurité » (`UsersPage`, admin)

Il affiche :
- l'état du verrouillage ;
- la double vérification, active ou non, avec sa date ;
- les clés d'accès (nombre et libellés) ;
- les appareils connus (`GET /api/users/:id/devices`).

Actions, toutes confirmées par une `Modal` et auditées :
- « Débloquer » ;
- « Réinitialiser la double vérification » ;
- « Révoquer les clés d'accès » ;
- « Déconnecter tous les appareils ».

La liste des utilisateurs gagne une colonne « Double vérification » (oui / non, avec une icône et un mot).

### 4.4 Nouvelle page « Mon compte » : `/agent/compte` et `/admin/compte`

Elle est accessible par le menu profil (BO-00). C'est le même composant dans les deux espaces.

**Profil :** nom, téléphone (`PATCH /api/me`), mot de passe (`PATCH /api/me/password`).

**Double vérification :**
- activer, avec QR code, code et codes de secours ;
- désactiver, sauf si la politique l'impose à son rôle.

**Clés d'accès :**
- « Ajouter une clé d'accès sur cet appareil », avec un libellé ;
- liste des clés et suppression.

**Appareils :**
- liste, avec l'appareil courant marqué « cet appareil » ;
- « Oublier » un appareil ;
- « Déconnecter tous les autres appareils ».

### 4.5 Page agent `/agent/securite` (F100)

Dans le menu Suivi, avec le code F100. Phrase d'introduction, 4 tuiles, panel des comptes verrouillés (sans IP, « Débloquer »), panel des derniers événements (période et type dans l'URL, « Afficher plus », `LiveDot`). L'encart « Derniers événements de sécurité » du tableau de bord détaillé (`days=1`, `limit=5`) y renvoie.

### 4.6 Paramètres (`SettingsPage`)

- Section Sécurité : `two_factor_required_roles`, choisis parmi Admin, Agent et Citoyen.
- Les seuils de blocage restent affichés en lecture seule, comme sur `plan-00`.

## 5. Étapes

Dans l'ordre, chaque étape est livrable seule :

1. [x] **F37 :**
   - [x] `/admin/securite` : vue d'ensemble, verrouillés, tentatives, encart cPanel ;
   - [x] entrée dans `nav.ts` ;
   - [x] messages de la page de connexion.
2. [x] **Révocation des sessions :** `token_version`, les deux endpoints, le message `SESSION_REVOKED`.
3. [x] **F54 :**
   - [x] `UserDevice` et l'en-tête `X-Device-Id` (posé par le client HTTP au login) ;
   - [x] notification et audit ;
   - [x] endpoints ;
   - [x] bloc « Nouveaux appareils » ;
   - [x] onglet Sécurité ;
   - [x] « Mon compte › Appareils ».
4. [x] **F53 :**
   - [x] schéma, `otplib`, `qrcode` ;
   - [x] connexion en deux temps ;
   - [x] politique ;
   - [x] étapes 2 et 3 de la page de connexion ;
   - [x] « Mon compte › Double vérification » ;
   - [x] réinitialisation par un admin ;
   - [x] jauge d'adoption.
5. [x] **D02 :**
   - [x] `Passkey` et `@simplewebauthn` ;
   - [x] enregistrement dans « Mon compte » ;
   - [x] bouton de connexion ;
   - [x] révocation par un admin.
6. [x] Audit de toutes ces actions (BO-03, § 3.3).
7. [x] **F100 :**
   - [x] `GET /api/security/events` (personnel, sans IP pour l'agent) ;
   - [x] page `/agent/securite` et entrée Suivi / ⌘K ;
   - [x] encart du tableau de bord détaillé.

## 6. Critères d'acceptation

1. **F37.**
   - 5 mots de passe faux sur `agent@` : la page de connexion affiche les essais restants, puis « Compte verrouillé, réessayez dans 15 min », avec un compte à rebours.
   - `admin@` voit le compte dans « Comptes verrouillés » et le débloque. L'agent se connecte aussitôt.
2. **F54.**
   - `agent@` se connecte depuis un second navigateur.
   - Sa cloche affiche « Nouvelle connexion depuis Firefox sur … ».
   - La page Sécurité liste cet appareil dans les dernières 24 h.
   - « Déconnecter tous les autres appareils » renvoie le premier navigateur à la connexion, avec « Session révoquée ».
3. **F53.**
   - La politique impose la double vérification aux admins. À sa connexion suivante, `admin@` doit l'activer : QR code, code, codes de secours.
   - Ensuite, la connexion demande le code à 6 chiffres. Un code faux compte comme un échec.
   - Un code de secours fonctionne une seule fois.
   - Un admin réinitialise la double vérification d'un agent : l'agent est prévenu et l'action apparaît dans l'audit.
4. **D02.**
   - Dans « Mon compte », `agent@` ajoute une clé d'accès (Touch ID, ou clé virtuelle des outils de développement de Chrome).
   - Il se déconnecte, puis se reconnecte avec « Se connecter avec une clé d'accès », sans saisir de mot de passe.
   - La politique de double vérification est satisfaite.
   - L'admin voit « 1 clé d'accès » dans sa fiche et peut la révoquer.
5. **F100.**
   - `agent@` ouvre « Sécurité » dans Suivi et dans ⌘K : le flux est lisible, sans IP.
   - Un compte verrouillé apparaît ; « Débloquer » le retire.
   - L'encart du tableau de bord détaillé et « Tout voir » mènent à la page.
   - `admin@` garde `/admin/securite` et reçoit `ip` sur les lignes d'audit de `GET /api/security/events`.
   - Sans token : 401. Citoyen : 403. Agent sur `/api/security/overview` : 403.

## 7. Version minimale

À faire en premier :
- F37 en entier ;
- F54 : notification, liste des appareils, révocation des sessions ;
- F53 pour le personnel seulement : TOTP, connexion en deux temps, « Mon compte ».

Peut attendre :
- D02 ;
- la jauge d'adoption ;
- les codes de secours. Sans eux, un admin réinitialise la double vérification d'un utilisateur bloqué.

## 8. Points d'attention

- **Secret TOTP :** il est stocké en clair dans la base, ce qui est acceptable pour le hackathon. En production, le chiffrer avec une clé de `.env`.
- **Jamais de secret dans le journal :** l'audit ne contient ni secret, ni code, ni clé publique.
- **Horloge :** le TOTP dépend de l'heure du serveur. Autoriser un décalage d'une période (`window: 1`).
- **Identifiant d'appareil :** il n'est pas une preuve d'identité. Il sert seulement à détecter un appareil inhabituel. Effacer le `localStorage` produit une nouvelle alerte, ce qui est normal ; le dire dans le texte d'aide de « Mon compte ».
- **Mot de passe provisoire (BO-04) :** on peut ajouter ici `must_change_password`. La page de connexion impose alors le changement du mot de passe avant l'accès.

## Réalisé (4 octobre 2026)

- **Politique par défaut : vide**, et non `["ADMIN"]` comme prévu, pour que les comptes de démo, `DevLogin` et les scripts de l'équipe continuent de se connecter par mot de passe. Un admin l'active dans Paramètres › Sécurité.
- **Connexion :** `completeLogin` (`auth.controller.ts`) décide pour toutes les méthodes : mot de passe, visage (`by-email`, qui ne vaut pas second facteur), code, clé d'accès. Les jetons d'étape portent un `purpose` et sont refusés par `authenticate`.
- **Appareils :** un compte dont c'est la première connexion n'est pas « nouveau » ; ensuite chaque appareil inconnu prévient la personne.
- **Écrans :** page de connexion à étapes, `/admin/securite`, « Mon compte » (`/agent/compte`, `/admin/compte`), onglet Sécurité du tiroir de compte, politique dans Paramètres.
- **Dépendances :** `otplib@12`, `qrcode`, `@simplewebauthn/server@14` (Node ≥ 20) côté backend, `@simplewebauthn/browser` côté front.
- **Pas fait :** `must_change_password`, chiffrement du secret TOTP.
- **Vérifié dans Chrome :** critères 1 à 4 (D02 avec l'authentificateur virtuel de Chrome).
- **F37 côté citoyen (4 oct. 2026) :** après un login API qui rapporte `failed_attempts_since_last_login > 0`, `/ville/espace` affiche une bannière dismissible (PLAN-01 / spec protection admin).
