# BO-09 : référentiels de la ville — transports, lieux, lexique

> **Rôle :**
> - Admin : édition des trois référentiels.
> - Agent : lecture, et changement d'état d'une ligne de transport, que le backend autorise au personnel.
>
> **Réfs :** D13 · F36 · F45 · F46. **XP :** 2 170.
> **Dépend de :** BO-00. Le BO-03 est recommandé, pour l'audit et l'historique.
> **Pendant citoyen :** PLAN-06 (transports), PLAN-07 (carte et urgences) et PLAN-09 (lexique) de `project-plan/`. Les modèles `Place` et `GlossaryTerm` sont les mêmes : ne les créer qu'une fois.
> **Effort :** ≈ 5 h. Transports ≈ 2 h, lieux ≈ 2 h, lexique ≈ 1 h.

## 1. Pourquoi ces réfs vont ensemble

Les quatre demandes reposent sur **des contenus de référence que l'admin tient à jour** et que l'habitant consulte : lignes et arrêts, lieux physiques et urgences, mots expliqués. Côté back-office, ce sont trois pages d'édition construites sur le même modèle :
- une liste filtrable (`DataTable`) ;
- un tiroir d'édition (`Drawer`) ;
- un aperçu « ce que voit l'habitant » ;
- l'historique (BO-03).

| Réf | Demandeur | Besoin | Ce que le back-office doit permettre |
|---|---|---|---|
| F36 | Service Mobilité | Consulter les horaires et infos des transports, comprendre vite et agir sans plusieurs écrans | Gérer les lignes, les arrêts et les horaires. Signaler une perturbation en une action, en prévenant les quartiers desservis. |
| F45 | Service Cartographie | Localiser les services physiques | Créer les lieux, les placer sur le plan d'un clic, les lier à un service |
| F46 | Citoyen | Savoir où sont les hôpitaux et services d'urgence | Marquer les lieux « Urgence » et « 24 h/24 ». Tenir à jour les numéros d'urgence. |
| D13 | Plusieurs citoyens | Comprendre les mots difficiles de la plateforme | Gérer le lexique : terme, définition simple, exemple, variantes, activation |

## 2. Écrans et état actuel

Aucun de ces écrans n'existe. Ce sont trois nouvelles pages, ajoutées au menu Admin, rubrique « Contenus ».

| Écran | Route | Rôle | Codes dans `nav.ts` |
|---|---|---|---|
| Transports | `/admin/transports` ; `/agent/transports` en lecture et changement d'état | Admin, Agent | F36 |
| Lieux et carte | `/admin/lieux` | Admin | F45 · F46 |
| Lexique | `/admin/lexique` ; `/agent/lexique` en lecture | Admin, Agent | D13 |

**Backend :**
- **Transports, prêts :**
  - lecture publique : `GET /api/transit/lines`, `/lines/:idOrCode?day=`, `/stops?district_id=&q=`, `/stops/:id?day=&at=` et `/disruptions` ;
  - gestion par le personnel : lignes et arrêts en CRUD, `PATCH /lines/:id/status { status, status_message, notify }`, `PUT /lines/:id/stops` et `PUT /lines/:id/timetable`.
- **Lieux :** absents. Modèle `Place` du PLAN-07, § 4.1.
- **Lexique :** absent. Modèle `GlossaryTerm` du PLAN-09, § 3.

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| Lieux (F45, F46) | Modèle `Place`, tel que défini au PLAN-07 § 4.1 : type, service, quartier, adresse, `map_x` et `map_y` (0-1000), téléphone, horaires, `is_24_7`, `is_emergency`, accessibilité, `is_active`. Endpoints : `GET /api/places?type=&emergency=&district_id=&service_id=&q=` et `GET /:id` publics ; `POST`, `PATCH /:id` et `DELETE /:id` réservés aux admins et audités. Seed : un lieu par service, plus l'hôpital, les pharmacies, les pompiers, la police, la mairie et un abri dans le quartier Sud. |
| Arrêts sur le plan | `map_x` et `map_y` (`Int?`) sur `TransitStop` |
| Numéros d'urgence (F46) | Clé de `PlatformSetting` `emergency_numbers` : `[{ label, number, description }]`. Elle est éditée dans le back-office (§ 4.2) et lue par l'habitant. |
| Lexique (D13) | Modèle `GlossaryTerm`, tel que défini au PLAN-09 § 3 : `slug`, `term`, `definition` (2 phrases au plus), `example`, `aliases`, `category`, `is_active`. Endpoints : `GET /api/glossary?q=` et `GET /:slug` publics ; `POST`, `PATCH /:id` et `DELETE /:id` réservés aux admins et audités. Seed : environ 25 termes. |
| Audit des transports | Ajouter `audit()` aux routes de gestion des transports : `transit.line_status`, `transit.stops`, `transit.timetable` (BO-03) |

## 4. Branchement écran par écran

Fichiers front : `src/api/transit.ts`, `src/api/places.ts`, `src/api/glossary.ts`.

### 4.1 Transports (F36)

| Onglet | Lecture | Actions |
|---|---|---|
| Lignes | `GET /api/transit/lines`, avec l'état et le message de chaque ligne | « Signaler une perturbation » ou « Rétablir » : `PATCH /lines/:id/status { status, status_message, notify }`. La case « Prévenir les habitants des quartiers desservis » règle `notify`, et le nombre de personnes prévenues est affiché après l'envoi. Cette action est ouverte aux agents. |
| Arrêts | `GET /api/transit/stops` | Créer, modifier ou supprimer un arrêt, avec son quartier. Le placer sur le plan, comme un lieu. |
| Détail d'une ligne | `GET /api/transit/lines/:id?day=` | Ordre des arrêts, par boutons monter/descendre accessibles au clavier : `PUT /lines/:id/stops`. Horaires : `PUT /lines/:id/timetable`. |

**Saisie des horaires**
- Pour chaque type de jour, on remplit trois champs : premier départ, dernier départ, fréquence. Exemple : 06:00, 22:00, toutes les 15 min.
- Le front génère la liste des départs, l'affiche en aperçu, puis l'envoie.
- Les heures sont au format « HH:MM », dans le fuseau du serveur.

**Aperçu habitant :** « Prochains départs à l'arrêt Dôme 2 », tel que l'affiche `/ville/transports`.

### 4.2 Lieux et carte (F45, F46)

**Mise en page :** une liste filtrable (type, quartier, urgence, service) à gauche, le plan de la ville à droite.

**Créer ou modifier (tiroir)**
- Nom, type, adresse, téléphone, horaires.
- Cases « Urgence » et « Ouvert 24 h/24 ».
- Service lié et quartier.
- Accessibilité.
- **Position :** clic sur le plan, qui remplit `map_x` et `map_y`. Le repère peut ensuite être déplacé au clavier, avec les flèches, par pas de 5.

**Section « Numéros d'urgence » (F46)**
- Édition de `emergency_numbers` : 15, 17, 18, 112 et le standard de la mairie.
- Aperçu de la page `/ville/urgences`.

**Lien avec les services :** dans le tiroir d'un service (BO-06), un onglet « Lieux d'accueil » liste ses lieux, avec un lien vers cette page.

**Plan partagé**
- La géométrie du plan (quartiers en coordonnées 0-1000) vit dans un module neutre, partagé avec l'espace citoyen (PLAN-07).
- Le back-office peut importer un module citoyen en lecture, comme il le fait déjà pour `useReducedMotion`. L'inverse est interdit.
- Si le PLAN-07 n'est pas livré, `shared/DistrictMap` sert de plan simplifié.

### 4.3 Lexique (D13)

- **Liste :** recherche, catégorie, actif ou inactif.
- **Tiroir :**
  - terme, définition, exemple, variantes, catégorie ;
  - aperçu de la bulle telle qu'elle apparaît à côté du mot souligné ;
  - aide : « 2 phrases au plus, sans jargon ».
- **Activer ou désactiver :** un terme désactivé n'est plus repéré dans les textes de l'habitant.
- **Agents :** lecture seule (`/agent/lexique`), pour employer les mêmes mots que les habitants dans leurs réponses.

## 5. Étapes

- [x] Transports (4 oct., détail et écarts : `project-plan/06-transports-F36.md` § 9) :
  - [x] audit des routes de gestion (déjà présent) ;
  - [x] `src/api/transit.ts` ;
  - [x] page avec les onglets Lignes, Arrêts et Détail, et la saisie des horaires par fréquence (aperçu, aller et retour) ;
  - [x] accès agent limité à l'état des lignes.
- [ ] Lieux :
  - [ ] `Place`, migration, endpoints, seed, `map_x` et `map_y` sur les arrêts, `emergency_numbers` ;
  - [ ] `src/api/places.ts` ;
  - [ ] page avec le plan et le placement d'un clic ;
  - [ ] onglet « Lieux d'accueil » des services.
- [ ] Lexique :
  - [ ] `GlossaryTerm`, migration, endpoints, seed ;
  - [ ] `src/api/glossary.ts` ;
  - [ ] page admin et lecture agent.
- [ ] `nav.ts` : trois entrées Admin, deux entrées Agent (Transports fait dans les deux espaces)

## 6. Critères d'acceptation

1. **F36.**
   - `agent@` signale une perturbation sur la ligne Anneau nord, avec « Reprise à 20:00 » et la prévenance cochée.
   - Les habitants des quartiers desservis reçoivent la notification.
   - `/ville/transports` affiche la ligne perturbée et son message.
   - L'admin modifie la fréquence d'une ligne. L'aperçu des départs change avant l'enregistrement.
2. **F45.** `admin@` crée « Mairie annexe Sud », la place d'un clic sur le plan et la lie à « État civil ». Le lieu apparaît sur `/ville/carte` et dans la fiche du service.
3. **F46.** Un lieu marqué « Urgence » et « 24 h/24 » apparaît sur `/ville/urgences`. La modification d'un numéro d'urgence y est visible aussitôt.
4. **D13.**
   - L'admin ajoute le terme « justificatif de domicile », avec une variante. Le mot est souligné dans une démarche côté habitant, avec la bonne définition.
   - Le désactiver le retire.
5. Chaque création ou modification figure dans l'audit, et dans l'onglet Historique du tiroir.

## 7. Version minimale

À faire en premier :
- l'onglet Lignes des transports, avec le changement d'état ;
- la liste et le tiroir des lieux, avec la saisie manuelle de `map_x` et `map_y` ;
- la liste et le tiroir du lexique.

Peut attendre :
- le placement d'un clic sur le plan ;
- la saisie des horaires par fréquence ;
- les aperçus habitant.

## 8. Points d'attention

- **Ordre de livraison :** les pages citoyennes (PLAN-06, PLAN-07, PLAN-09) peuvent arriver après le back-office. Dans ce cas, l'aperçu habitant est le seul moyen de montrer l'effet d'une modification. Le garder simple, mais fidèle.
- **Numéros d'urgence :** une erreur est grave. Exiger une confirmation pour toute modification de `emergency_numbers`, et la tracer dans l'audit.
