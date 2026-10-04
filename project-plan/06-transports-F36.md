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

- [x] Seed : arrêts dans chaque quartier, horaires, une perturbation
- [x] Créer `src/api/transit.ts`
- [x] Page `/ville/transports` : état du réseau, prochains départs, recherche, fiche ligne, favoris
- [x] Raccourci sur l'accueil et perturbations dans la section État de la ville (avec le PLAN-02)
- [x] Page `/admin/transports` : lignes, arrêts, ordre des arrêts, horaires générés ; entrée de menu
- [x] Notification de perturbation : vérifier qu'elle mène à la ligne (lien traduit par `citizenLink` ; la cloche citoyenne arrive avec le PLAN-04)

## 7. Critères d'acceptation

**F36 :**
- Depuis l'accueil, en un seul écran, l'habitant voit les prochains départs à ses arrêts (en minutes et en heure) et les perturbations en cours, avec la reprise prévue.
- Un agent signale une perturbation sur une ligne en cochant « Prévenir ». L'habitant d'un quartier desservi :
  - la voit en 60 s au plus ;
  - reçoit une notification qui ouvre la ligne.

## 8. Version minimale

Page `/ville/transports` (état du réseau, prochains départs dans mon quartier, fiche ligne) et changement d'état d'une ligne dans le back-office.

Ces éléments peuvent attendre : favoris, gestion des arrêts, éditeur d'horaires.

## 9. Réalisé et écarts au plan

**Vérifié (4 octobre) :**
- Frontend : `tsc -b`, lint des fichiers touchés, tests vitest (`features/transit`, `lib/links`, `backoffice/lib/timetable`). La suite complète passe à 170 sur 171 et le lint garde 3 erreurs, dans des fichiers que ce plan ne touche pas : `useSpeakMessage.test.ts`, `AccessHologram.tsx` et `useRealtimeTranscription.ts`.
- Backend : `npm run typecheck`, `npm run check:permissions`, `npm run seed` relancé deux fois.
- Parcours testés dans Chrome :
  - `citoyen@` (quartier Sud) sur `/ville/transports?ligne=A1` :
    - la fiche s'ouvre et prend le focus ;
    - l'état du réseau montre A1 et N3 ;
    - les départs de Berges du Sud et Réservoir s'affichent en minutes et en heure ;
    - l'étoile enregistre un favori, qui passe en tête ;
    - la recherche « Dôme » trouve les arrêts.
  - Accueil, section État de la ville : le bloc Transports liste les lignes perturbées.
  - `agent@` sur `/agent/transports` signale T1 « Perturbée » avec « Prévenir ». Le toast annonce « 4 habitants prévenus », et `citoyen@` reçoit « Ligne T1 : perturbée », lien `/transport/lines/T1`.
  - `admin@`, horaires de T1 :
    - passer la fréquence de 10 à 20 min fait tomber l'aperçu de 106 à 53 passages par sens avant l'enregistrement ;
    - l'enregistrement crée 848 départs ;
    - « Rétablir » retire T1 des perturbations.

**Écarts :**

| Prévu | Fait | Pourquoi |
|---|---|---|
| Seed : 3 à 4 lignes | Ajout de `A1` « Navette Anneau nord » (interrompue, « Reprise à 20:00 ») et de l'arrêt `PAN` « Pont de l'Anneau » (non accessible) | Le critère du BO-09 et le script de Nova parlent de l'anneau nord. L'arrêt non accessible montre la mention F21. |
| Horaires dans un seul sens | Aller et retour : `buildRegularService` (`lib/transit.ts`), utilisé par le seed et par `PUT /lines/:id/timetable` (`return_trip`, vrai par défaut) | Au terminus, l'écran affichait « vers Berges du Sud », c'est-à-dire des arrivées. Le front masque aussi les passages dont la direction est l'arrêt lui-même. |
| Fiche ligne : `times` par arrêt | `GET /lines/:idOrCode` renvoie aussi `times_by_direction`, et la fiche affiche un tableau par sens | Les deux sens mélangés dans une même colonne d'horaires étaient illisibles. |
| « Reprise prévue » | Écrite dans `status_message`, aucune migration | Le message dit déjà quoi faire. Le back-office le demande en aide de saisie. |
| La notification ouvre la ligne | Pour l'habitant, `citizenLink` (`lib/links.ts`) traduit `/transport/lines/T1` en `/ville/transports?ligne=T1`. Pour le personnel, `staffLink` mène à `/<espace>/transports?ligne=T1` | L'espace citoyen n'a pas encore de cloche (PLAN-04). Elle n'aura qu'à appeler `citizenLink`. |
| Fiche ligne sur une page à part | Panneau dans `/ville/transports`, ouvert par `?ligne=` | La demande F36 dit « sans parcourir plusieurs écrans ». |
| `/admin/transports` | Même page pour `/agent/transports` : les agents lisent, signalent et rétablissent, les admins gèrent aussi lignes, arrêts, ordre et horaires | Le backend autorise le changement d'état à tout le personnel. |
