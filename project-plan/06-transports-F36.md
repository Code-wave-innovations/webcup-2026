# PLAN-06 : transports municipaux

> **Réfs :** F36 · **XP :** 580
> **Dépend de :** PLAN-00 (et PLAN-01 pour enregistrer les arrêts favoris)
> **Débloque :** PLAN-07, pour la rubrique « Comment y aller » de la carte
> **Effort :** environ 3 h

## 1. Besoin

La demande F36 vient du Service Mobilité : « Les habitants doivent pouvoir consulter les horaires et infos des transports municipaux. L'habitant doit pouvoir comprendre rapidement l'information utile à sa situation et agir sans devoir parcourir plusieurs écrans. »

On en tire **un seul écran**, organisé autour de « mon quartier, mes arrêts », avec deux usages :
- voir les prochains départs à mon arrêt ;
- savoir tout de suite si une ligne que j'utilise est perturbée.

## 2. Existant

### Backend (prêt)

**Consultation (public) :**
- `GET /api/transit/lines` : liste des lignes.
- `GET /api/transit/lines/:idOrCode?day=` : une ligne, avec ses arrêts et ses horaires pour un type de jour.
- `GET /api/transit/stops?district_id=&q=` : recherche d'arrêts.
- `GET /api/transit/stops/:id?day=&at=` : prochains départs à un arrêt.
- `GET /api/transit/disruptions` : perturbations en cours.

**Gestion (personnel) :**
- Lignes et arrêts : création, modification, suppression.
- `PATCH /lines/:id/status { status, status_message, notify }` : changer l'état d'une ligne. Avec `notify`, les habitants des quartiers desservis sont prévenus.
- `PUT /lines/:id/stops` : ordre des arrêts.
- `PUT /lines/:id/timetable` : horaires.

**Format des horaires :** `TransitDeparture.time` est un texte « HH:MM », exprimé dans le fuseau horaire `TZ` du processus.

### Front citoyen

Une seule ligne écrite en dur, « Transports : anneau nord, reprise à 20:00 », dans `features/services/services.ts`.

### Back-office

Aucune page transports.

## 3. Backend

Rien de bloquant. À vérifier ou compléter dans le seed :
- au moins un arrêt par quartier ;
- 3 à 4 lignes, avec des horaires pour chaque type de jour ;
- une ligne perturbée, avec son `status_message`.

Le PLAN-07 ajoute `map_x` et `map_y` aux arrêts, pour les placer sur le plan de la ville.

## 4. Front citoyen : `/ville/transports`

Un écran en trois blocs, de haut en bas.

**1. État du réseau**
- Chaque ligne perturbée ou interrompue (`/disruptions`) apparaît avec son code, son nom, son état (en texte et avec une icône), le message et la reprise prévue.
- S'il n'y a aucune perturbation : « Toutes les lignes fonctionnent normalement ».

**2. Prochains départs près de chez moi**
- Les arrêts de mon quartier : `/stops?district_id=<quartier du profil>`.
- Pour chaque arrêt, les 3 prochains départs par ligne et par direction (`/stops/:id?at=<maintenant>`), affichés en minutes (« dans 4 min ») suivies de l'heure.
- Arrêts favoris :
  - une étoile permet d'en ajouter ;
  - ils sont enregistrés dans `User.preferences.favorite_stops` (`PATCH /api/me`) ;
  - ils s'affichent en premier.
- Sans compte ou sans quartier renseigné, on propose de choisir un quartier ou de chercher un arrêt.

**3. Chercher un arrêt ou une ligne**
- Recherche par nom (`q`).
- Fiche d'une ligne :
  - liste ordonnée de ses arrêts ;
  - état de la ligne ;
  - horaires du jour, selon le type de jour (`day`).

**Règles communes aux trois blocs**
- L'écran se rafraîchit toutes les 60 s.
- Une ligne est toujours identifiée par son code et son nom, jamais par sa seule couleur.
- Les horaires sont lisibles aussi sous forme de tableau.

**Liens avec les autres plans**
- Accueil (PLAN-02) : un raccourci « Transports », et les perturbations dans la section État de la ville.
- Notifications (PLAN-04) : une perturbation signalée avec `notify` arrive dans la cloche et mène à la ligne.
- Carte (PLAN-07) : la rubrique « Comment y aller » d'un lieu affiche l'arrêt le plus proche et les lignes qui le desservent.

## 5. Back-office

Nouvelle page **`/admin/transports`**, au style du back-office (`DataTable`, `Drawer`, `Tabs`, `StatusPill`). Elle s'ajoute au menu Admin, rubrique « Contenus » (code F36). Les agents la voient en lecture seule et peuvent seulement changer l'état d'une ligne, ce que le backend autorise à tout le personnel.

| Onglet | Lecture | Actions |
|---|---|---|
| Lignes | `GET /api/transit/lines` | « Signaler une perturbation » / « Rétablir » : `PATCH /lines/:id/status { status, status_message, notify }`. Une case à cocher « Prévenir les habitants des quartiers desservis » règle `notify`. |
| Arrêts | `GET /api/transit/stops` | Création, modification et suppression d'arrêts (avec le quartier). Après le PLAN-07, placement sur le plan. |
| Détail d'une ligne | `GET /api/transit/lines/:id?day=` | Ordre des arrêts, par glisser-déposer ou boutons monter/descendre : `PUT /lines/:id/stops`. Horaires : `PUT /lines/:id/timetable`. |

**Saisie des horaires**

On ne saisit pas les départs un par un. Pour chaque type de jour, on remplit trois champs : premier départ, dernier départ, fréquence. Exemple : 06:00, 22:00, toutes les 15 min. Le front génère les horaires, les affiche en aperçu, puis les envoie.

## 6. Étapes

- [ ] Seed : arrêts dans chaque quartier, horaires, une perturbation
- [ ] Créer `src/api/transit.ts`
- [ ] Page `/ville/transports` : état du réseau, prochains départs, recherche, fiche ligne, favoris
- [ ] Raccourci sur l'accueil et perturbations dans la section État de la ville (avec le PLAN-02)
- [ ] Page `/admin/transports` : lignes, arrêts, ordre des arrêts, horaires générés ; entrée de menu
- [ ] Notification de perturbation : vérifier qu'elle mène à la ligne

## 7. Critères d'acceptation

**F36 :**
- Depuis l'accueil, en un seul écran, l'habitant voit les prochains départs à ses arrêts (en minutes et en heure) et les perturbations en cours, avec la reprise prévue.
- Un agent signale une perturbation sur une ligne en cochant « Prévenir ». L'habitant d'un quartier desservi :
  - la voit en 60 s au plus ;
  - reçoit une notification qui ouvre la ligne.

## 8. Version minimale

Page `/ville/transports` (état du réseau, prochains départs dans mon quartier, fiche ligne) et changement d'état d'une ligne dans le back-office.

Ces éléments peuvent attendre : favoris, gestion des arrêts, éditeur d'horaires.
