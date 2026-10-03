# BO-10 : participation citoyenne — projets, consultations, idées, soutiens, questions sur les données

> **Rôle :**
> - Admin : projets, consultations, publication des résultats, réponses de référence sur les données.
> - Agent : modération des idées, réponses aux questions, suivi des soutiens.
>
> **Réfs :** F51 · F52 · F65 · F66 · F67 · F68. **XP :** 4 610.
> **Dépend de :**
> - BO-00 ;
> - BO-01, car les idées et les questions passent par la file des demandes ;
> - BO-03, pour l'audit de la modération.
>
> **Pendant citoyen :** ces demandes (vagues 8 et 12) ne sont pas encore planifiées dans `project-plan/`. Ce plan définit le backend complet, y compris les endpoints dont l'espace citoyen aura besoin. Les écrans habitants restent à planifier.
> **Effort :** ≈ 7 h.

## 1. Pourquoi ces réfs vont ensemble

Les six demandes répètent la même exigence :
> « Cette participation doit être simple à comprendre et laisser une trace suffisamment claire pour que l'habitant sache que sa contribution a bien été prise en compte. »

Côté back-office, c'est un seul métier :
1. recevoir une contribution ;
2. la modérer ou y répondre ;
3. **rendre la suite visible** à son auteur.

| Réf | Demandeur | Besoin | Ce que le back-office doit permettre |
|---|---|---|---|
| F51 | Collectif citoyen, quartier Nord | Comprendre l'usage de ses données et faire remonter ses inquiétudes, avec une trace | Une file « Questions sur les données ». Répondre à chacune. Publier les réponses utiles dans la FAQ « Vos données ». |
| F52 | Citoyen | Soutenir une demande déjà déposée par d'autres | Rendre une demande soutenable (publique). Voir le nombre de soutiens, trier par soutiens, fusionner les doublons. |
| F65 | Haut Conseil | Soumettre certaines décisions à l'avis des habitants | Une consultation « décision » : options, période, public. Résultats en direct. Publication de ce que la ville retient. |
| F66 | Citoyenne | Donner son avis sur un projet, sans vote officiel, et savoir qu'il est enregistré | Une consultation « avis libre » : commentaires, modération, accusé de réception, synthèse publiée |
| F67 | Service Projets | Consulter les projets en cours | Créer et publier des projets : état, avancement, quartier, dates. Publier des nouvelles du projet. |
| F68 | Citoyen | Proposer des idées pour améliorer la colonie | Une file « Idées » : publier, ne pas retenir (avec un motif), retenir, marquer réalisée, avec une réponse à chaque étape |

## 2. Décisions

| # | Décision | Pourquoi |
|---|---|---|
| D-1 | **Idées (F68) et questions sur les données (F51) sont des `CitizenRequest`**, avec deux nouveaux types : `IDEA` et `DATA_CONCERN`. | La « trace » existe déjà pour les demandes : référence, étapes (`RequestEvent`), avis à l'auteur à chaque changement (F49), file de l'agent, audit. On la réutilise au lieu de la recréer. |
| D-2 | **Un seul mécanisme de soutien** (`RequestSupport`) pour les signalements (F52) et les idées (F68). | Même geste pour l'habitant, même colonne « Soutiens » dans le back-office. |
| D-3 | **`is_public`** sur `CitizenRequest` : rien n'est public par défaut. Un agent publie une idée après modération, ou rend un signalement soutenable. | Aucune donnée personnelle n'est exposée sans décision. Les vues publiques sont toujours anonymisées. |
| D-4 | **Consultations et projets sont des modèles à part** : `Project` et `Consultation`. | Ce sont des contenus que publie la ville, pas des demandes d'habitants. |
| D-5 | **Toute consultation se termine par une synthèse publiée** (« Ce que la ville retient »), envoyée à tous les participants. | C'est la trace finale demandée par F65 et F66. Une consultation close sans synthèse reste signalée « Synthèse à publier » dans le back-office. |

## 3. Backend

### 3.1 Demandes : nouveaux types, publication et soutiens

```prisma
enum RequestType {
  CONTACT
  PROCEDURE
  INCIDENT
  IDEA          // F68
  DATA_CONCERN  // F51
}

model CitizenRequest {
  // … champs existants …
  is_public Boolean @default(false)  // F52 / F68 : visible (anonymisée) et soutenable par les autres habitants
  supports  RequestSupport[]
}

// F52 / F68: residents supporting a request or an idea
model RequestSupport {
  request_id Int
  user_id    Int
  created_at DateTime @default(now())

  request CitizenRequest @relation(fields: [request_id], references: [id], onDelete: Cascade)
  user    User           @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([request_id, user_id])
}
```

**Endpoints côté habitant**
- `GET /api/requests/public?type=INCIDENT|IDEA&district_id=&sort=recent|supporters` : vue **anonymisée** des demandes publiques. Elle contient la référence, le type, l'objet, la catégorie, le quartier, l'état, la date, `supporters_count` et `supported_by_me`, sans nom ni message complet d'un autre habitant.
- `POST /api/requests/:id/support` et `DELETE /api/requests/:id/support`.
  - Ils sont réservés aux demandes publiques.
  - On ne soutient pas sa propre demande.
  - Le soutien envoie un accusé de réception à son auteur : « Votre soutien à NT-… est enregistré ».

**Endpoints côté personnel**
- `GET /api/requests` accepte `type=IDEA|DATA_CONCERN`, `is_public` et `sort=supporters`. Chaque ligne porte `supporters_count`.
- `PATCH /api/requests/:id` accepte `is_public`. Le passage à public est refusé pour `DATA_CONCERN`.
- `GET /api/requests/:id/supporters` : la liste des soutiens, réservée au personnel.
- `POST /api/requests/:id/merge { into_id }`, **facultatif** :
  - la demande en double passe à `CLOSED`, avec l'étape publique « Regroupée avec NT-… » ;
  - ses soutiens, et son auteur, deviennent des soutiens de la demande cible ;
  - l'auteur est prévenu.

**Suivi pour les soutiens :** à chaque changement d'état public d'une demande soutenue, ses soutiens reçoivent aussi l'avis (même logique que F49).

**Libellés par type :** les libellés d'état dépendent du type, côté backend pour le titre des notifications, et côté front dans `lib/labels.ts`.

| Statut | `IDEA` | `DATA_CONCERN` |
|---|---|---|
| `SUBMITTED` | Reçue | Reçue |
| `IN_REVIEW` | À l'étude | En cours d'examen |
| `IN_PROGRESS` | Retenue | — |
| `RESOLVED` | Réalisée | Répondue |
| `REJECTED` | Non retenue (motif obligatoire) | — |
| `CLOSED` | Close | Close |

Le message public obligatoire du BO-01 (F49) s'applique aussi à « Retenue », « Non retenue », « Réalisée » et « Répondue ».

### 3.2 FAQ « Vos données » (F51)

- **Stockage :** clé de `PlatformSetting` `data_faq` : `[{ id, topic, question, answer, updated_at, from_reference? }]`. Elle n'a pas besoin de migration, la table existant depuis `plan-00`.
- **Lecture :** publique, par `GET /api/settings/public`.
- **Écriture :** `PATCH /api/settings`, réservé aux admins et audité.
- **Thèmes proposés :** compte, demandes, localisation, notifications, santé, appareils et sécurité, autre. Le thème est aussi la `category` des `DATA_CONCERN`.

### 3.3 Projets (F67)

```prisma
enum ProjectStatus {
  PLANNED
  IN_PROGRESS
  DONE
  SUSPENDED
}

// F67: city projects residents can follow
model Project {
  id           Int           @id @default(autoincrement())
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt
  slug         String        @unique
  title        String
  summary      String        @db.VarChar(500)
  description  String        @db.Text
  status       ProjectStatus @default(PLANNED)
  progress     Int           @default(0)       // 0–100
  district_id  Int?
  service_id   Int?
  starts_on    DateTime?
  ends_on      DateTime?
  budget_label String?                         // « 1,2 M crédits », texte libre
  image        String?
  is_published Boolean       @default(false)

  updates       ProjectUpdate[]
  consultations Consultation[]
}

model ProjectUpdate {
  id         Int      @id @default(autoincrement())
  created_at DateTime @default(now())
  project_id Int
  title      String
  body       String   @db.Text
  author_id  Int?

  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)
}
```

**Endpoints**
- Lecture publique, projets publiés uniquement : `GET /api/projects?status=&district_id=` et `GET /api/projects/:idOrSlug`, avec les nouvelles et les consultations liées.
- Écriture, réservée aux admins et auditée : `POST`, `PATCH /:id`, `DELETE /:id` et `POST /:id/updates`.

### 3.4 Consultations (F65, F66)

```prisma
enum ConsultationKind {
  OPINION   // F66 : avis libre, pas un vote officiel
  DECISION  // F65 : avis sur une décision, entre plusieurs options
}

enum ConsultationStatus {
  DRAFT
  OPEN
  CLOSED
  RESULTS_PUBLISHED
}

model Consultation {
  id              Int                @id @default(autoincrement())
  created_at      DateTime           @default(now())
  slug            String             @unique
  title           String
  question        String             @db.Text
  context         String             @db.Text
  kind            ConsultationKind
  status          ConsultationStatus @default(DRAFT)
  project_id      Int?
  district_ids    Json?              // public visé ; vide = toute la ville
  options         Json?              // DECISION : [{ key, label, description }]
  allow_comment   Boolean            @default(true)
  opens_at        DateTime
  closes_at       DateTime
  results_summary String?            @db.Text   // « Ce que la ville retient » : la trace finale
  results_at      DateTime?

  project   Project?               @relation(fields: [project_id], references: [id], onDelete: SetNull)
  responses ConsultationResponse[]
}

model ConsultationResponse {
  id              Int       @id @default(autoincrement())
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  consultation_id Int
  user_id         Int
  option_key      String?
  comment         String?   @db.Text
  receipt         String    @unique   // AV-261003-7K2Q, affiché à l'habitant
  is_hidden       Boolean   @default(false)  // modération d'un commentaire abusif

  consultation Consultation @relation(fields: [consultation_id], references: [id], onDelete: Cascade)

  @@unique([consultation_id, user_id])
}
```

**Endpoints côté habitant**
- `GET /api/consultations?status=OPEN|RESULTS_PUBLISHED` et `GET /:idOrSlug`, avec `my_response` si l'habitant a répondu.
- `POST /api/consultations/:id/responses { option_key?, comment? }` :
  - une réponse par habitant, modifiable jusqu'à la clôture ;
  - la réponse renvoie le `receipt` ;
  - un accusé de réception est envoyé : « Votre avis sur … est enregistré (AV-…) ».

**Endpoints côté admin** (tous audités)
- `POST`, `PATCH /:id`, `POST /:id/open` et `POST /:id/close`.
- `GET /:id/results` : décompte par option, nombre de participants, participation par quartier, commentaires.
- `PATCH /responses/:id { is_hidden }`, pour la modération. Ouvert aussi aux agents.
- `POST /:id/publish-results { results_summary }` : passe la consultation à `RESULTS_PUBLISHED`, puis prévient tous les participants (« Résultat de la consultation … : ce que la ville retient »).
- `GET /:id/export.csv` : réponses anonymisées.

**Planificateur :** `lib/scheduler.ts` ouvre et ferme les consultations à `opens_at` et `closes_at`.

## 4. Back-office

### 4.1 Nouvelles entrées du menu

| Espace | Rubrique | Entrées |
|---|---|---|
| Admin | « Participation » | `/admin/projets` (F67), `/admin/consultations` (F65 · F66), `/admin/contributions` (F51 · F52 · F68) |
| Agent | « Traitement » | `/agent/contributions` (F51 · F52 · F68), même composant que l'admin, sans l'édition de la FAQ |

Badge `contributions` : le nombre d'idées et de questions à l'état `SUBMITTED`.

Fichiers front : `src/api/participation.ts` (projets, consultations, résultats) et `src/api/requests.ts`, étendu (soutiens, `is_public`, fusion).

### 4.2 Contributions (F51, F52, F68)

| Onglet | Lecture | Actions |
|---|---|---|
| Idées (F68) | `GET /api/requests?type=IDEA&sort=` | Publier (`PATCH { is_public: true, status: 'IN_REVIEW' }`). Ne pas retenir (`REJECTED`, motif public obligatoire). Retenir (`IN_PROGRESS`, réponse). Réalisée (`RESOLVED`). Chaque action prévient l'auteur. |
| Questions sur les données (F51) | `GET /api/requests?type=DATA_CONCERN`, groupées par thème (`category`) | Répondre : `PATCH { status: 'RESOLVED', note }`. « Ajouter à la FAQ » (admin) : la question reformulée sans donnée personnelle et la réponse s'ajoutent à `data_faq` (`from_reference` garde le lien), et l'auteur est prévenu que sa question a servi. |
| Les plus soutenues (F52) | `GET /api/requests?is_public=true&sort=supporters` (signalements et idées) | Ouvrir le détail (BO-01). Rendre public ou privé un signalement. Fusionner un doublon (`merge`, facultatif). |
| FAQ « Vos données » (admin) | `GET /api/settings` → `data_faq` | Ajouter, modifier, réordonner, supprimer. Aperçu de la page habitant. |

**Dans la file des demandes (BO-01)**
- Les types `IDEA` et `DATA_CONCERN` apparaissent dans le filtre « Type ».
- La colonne « Soutiens » s'affiche.
- `RequestDetailPage` gagne :
  - un bloc « Soutiens (N) », avec la liste réservée au personnel ;
  - la bascule « Visible et soutenable par les habitants » (`is_public`), avec l'aperçu anonymisé de ce que verront les autres habitants.

### 4.3 `/admin/projets` (F67)

- **Liste :** état, avancement (barre et pourcentage écrit), quartier, publié ou non.
- **Tiroir :**
  - titre, résumé, description, état, avancement, quartier, service, dates, budget, image ;
  - « Publier » et « Dépublier » ;
  - aperçu de la carte du projet côté habitant.
- **Onglet « Nouvelles » :** publier une nouvelle (`POST /:id/updates`).
- **Onglet « Consultations » :** les consultations liées, et « Lancer une consultation sur ce projet ».
- **Onglet « Historique » :** BO-03.

### 4.4 `/admin/consultations` (F65, F66)

**Liste par état :** brouillon, ouverte (avec un compte à rebours de clôture), close avec « Synthèse à publier », résultats publiés.

**Éditeur**
- Type de consultation :
  - « Avis libre » (F66), pas un vote ;
  - « Avis sur une décision » (F65), avec 2 à 5 options, chacune avec un libellé et une explication.
- Question, contexte, projet lié, public (quartiers ou toute la ville), dates d'ouverture et de clôture, commentaires autorisés.
- Aperçu du formulaire habitant.
- **Mention imposée pour F65 :** « Avis consultatif : la décision finale revient au Haut Conseil ».

**Résultats** (`GET /:id/results`, rafraîchis toutes les 30 s pendant l'ouverture)
- Participants, et participation par quartier.
- Pour une décision : barres par option, avec la vue tableau (`ChartFrame`).
- Commentaires, avec « Masquer » pour la modération. Un commentaire masqué reste compté, et son auteur voit « Masqué par la modération ».

**Clôture et synthèse**
- « Clôturer maintenant » (`POST /:id/close`).
- « Publier la synthèse » : un texte obligatoire, aidé d'une structure (« Ce que vous avez dit », « Ce que la ville décide », « Prochaines étapes »). L'envoi prévient tous les participants.
- « Exporter les réponses » (CSV anonymisé).

## 5. Étapes

- [ ] Backend, demandes :
  - [ ] types `IDEA` et `DATA_CONCERN` ;
  - [ ] `is_public` et `RequestSupport` ;
  - [ ] vue publique anonymisée ;
  - [ ] soutien et retrait ;
  - [ ] `sort=supporters` et liste des soutiens ;
  - [ ] avis aux soutiens ;
  - [ ] libellés par type ;
  - [ ] `merge` (facultatif).
- [ ] Backend : `data_faq` dans `lib/settings.ts`, lecture publique
- [ ] Backend : `Project`, `ProjectUpdate`, endpoints, seed (3 projets, dont un lié à une consultation)
- [ ] Backend : `Consultation`, `ConsultationResponse`, endpoints, ouverture et clôture par le planificateur, accusés de réception, synthèse, export, seed (une consultation ouverte de chaque type)
- [ ] Audit de toutes ces actions (BO-03)
- [ ] `src/api/participation.ts`, et extension de `requests.ts`
- [ ] Page Contributions : onglets Idées, Questions sur les données, Les plus soutenues, FAQ
- [ ] Ajouts à la file et au détail des demandes (BO-01) : types, soutiens, `is_public`
- [ ] `/admin/projets`
- [ ] `/admin/consultations`, avec les résultats et la synthèse
- [ ] `nav.ts` et badge `contributions`

## 6. Critères d'acceptation

Ces scénarios se vérifient avec les endpoints habitants (`curl` ou client HTTP) tant que les écrans citoyens ne sont pas faits.

1. **F68.**
   - Un habitant propose une idée : il reçoit la référence et l'accusé de réception.
   - `agent@` la voit dans « Idées » et la publie : elle apparaît dans `GET /api/requests/public?type=IDEA`, sans le nom de son auteur.
   - L'agent la marque « Retenue » avec une réponse : l'auteur est prévenu, et l'étape figure dans son suivi.
2. **F52.**
   - L'agent rend un signalement public. Deux autres habitants le soutiennent.
   - Le back-office affiche « 2 soutiens » et le place en tête de « Les plus soutenues ».
   - Quand l'agent le passe à « En cours », l'auteur **et** les deux soutiens sont prévenus.
3. **F65.**
   - `admin@` crée une consultation « décision » à 3 options sur le quartier Nord, ouverte 7 jours.
   - Trois habitants répondent : chacun reçoit un reçu `AV-…`. Les barres se mettent à jour.
   - Après la clôture, la consultation est signalée « Synthèse à publier ». La publication prévient les trois participants.
4. **F66.**
   - Dans une consultation « avis libre », un habitant laisse un commentaire et reçoit son reçu.
   - L'admin masque un commentaire abusif : il reste compté, et l'action est dans l'audit.
5. **F67.** Un projet publié avec un avancement de 40 % et une nouvelle apparaît dans `GET /api/projects`, avec sa consultation liée. Dépublié, il disparaît.
6. **F51.**
   - Un habitant demande « Qui peut voir mon adresse ? ». La question arrive dans « Questions sur les données », au thème « Compte ».
   - L'admin répond : l'habitant est prévenu.
   - « Ajouter à la FAQ » publie la question reformulée dans `data_faq`, et l'auteur est prévenu que sa question a servi.
   - Une question sur les données ne peut jamais être rendue publique.

## 7. Version minimale

À faire en premier :
- `IDEA` et `DATA_CONCERN`, avec la page Contributions (onglets Idées et Questions) : F68 et F51 réutilisent toute la mécanique des demandes ;
- `is_public` et les soutiens (F52) ;
- les consultations « avis libre » et « décision », sans export ni planificateur (ouverture et clôture manuelles) ;
- les projets, sans les nouvelles.

Peut attendre :
- la FAQ « Vos données » (la réponse individuelle suffit) ;
- `merge` ;
- les nouvelles de projet ;
- la participation par quartier.

## 8. Points d'attention

- **Anonymat :** la vue publique ne renvoie jamais de nom, d'e-mail, de pièce jointe ni de message complet. Le vérifier avec un test, car c'est la première fois qu'une demande d'habitant est lisible par un autre habitant.
- **Une réponse par habitant :** la contrainte `@@unique([consultation_id, user_id])` le garantit. Le serveur, pas l'interface, fait respecter « une personne, un avis ».
- **Vocabulaire :** ne pas présenter une consultation comme un vote officiel (F66 le précise). L'interface parle d'« avis », de « participation » et de « synthèse ».
- **Questions sur les données :** elles peuvent contenir des informations sensibles. Elles ne sont lisibles que par le personnel, et le journal d'audit n'en copie pas le contenu.
