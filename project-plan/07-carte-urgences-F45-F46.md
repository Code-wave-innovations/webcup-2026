# PLAN-07 : carte des services et urgences

> **Réfs :** F45 · F46 (XP 1 280)
> **Dépend de :** PLAN-00 et PLAN-02 (fiches service, recherche). PLAN-06 est recommandé, pour les arrêts les plus proches.
> **Effort :** environ 4 h 30

## 1. Pourquoi ces deux demandes vont ensemble

F45 demande de localiser les services physiques de la ville. F46 demande où se trouvent les hôpitaux et les services d'urgence.

Les deux reposent sur la même donnée : les **lieux physiques**, avec une position, des horaires et un téléphone. Elles s'affichent dans le même composant, un plan de la ville accompagné d'une liste. F46 en est la version prioritaire : les lieux d'urgence, accessibles en un clic depuis n'importe quelle page.

Les deux demandes partagent aussi la même exigence : comprendre vite l'information et agir sans passer par plusieurs écrans.

| Réf | Demandeur | Besoin | Ce qui prouve que c'est fait |
|---|---|---|---|
| F45 | Service Cartographie | Localiser les services physiques de la ville | Plan et liste des lieux, accessibles depuis chaque fiche service |
| F46 | Citoyen | Savoir où sont les hôpitaux et les services d'urgence | Bouton « Urgences » présent partout : numéros d'urgence et lieux ouverts |

## 2. Existant

- **Services :** `CityService` contient `address` et `opening_hours` en texte, mais aucune position. Un service peut pourtant avoir plusieurs lieux (centre de santé et ses antennes, mairie et mairies annexes).
- **Arrêts et demandes :** `TransitStop` a des champs `latitude` et `longitude`, vides dans le seed. `CitizenRequest` a aussi des `latitude` et `longitude`, utilisées par F25.
- **Front :**
  - aucune carte n'existe ;
  - le back-office affiche les quartiers en tuiles hexagonales (`shared/DistrictMap`), un schéma sans positions.
- **Fond de carte :** Terra Nova est une ville fictive, donc aucun fond de carte réel ne peut servir.

## 3. Décision : un plan SVG de Terra Nova, pas Leaflet ni OpenStreetMap

- **Pas de fond réel :** la ville étant fictive, des tuiles réelles n'auraient pas de sens. On dessine un plan SVG maison : les 5 quartiers, les axes principaux, le dôme central et le réservoir au sud. Il reste cohérent avec la scène 3D, n'ajoute aucune dépendance et fonctionne hors ligne.
- **Coordonnées :** les positions sont des **coordonnées de plan**, `map_x` et `map_y`, de 0 à 1000. Les champs `latitude` et `longitude` restent facultatifs, au cas où l'on passerait plus tard à un fond réel.
- **La liste d'abord :** la **liste** est le contenu principal, car elle sert aux lecteurs d'écran et reste lisible avec un zoom à 400 %. Le plan est une aide visuelle synchronisée avec elle.

## 4. Backend

### 4.1 Schéma

```prisma
// F45 / F46: physical places of the city (service desks, hospitals, emergency services…)
enum PlaceType {
  HOSPITAL
  EMERGENCY
  HEALTH_CENTER
  PHARMACY
  TOWN_HALL
  SERVICE_DESK
  POLICE
  FIRE_STATION
  SHELTER
  OTHER
}

model Place {
  id            Int       @id @default(autoincrement())
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  name          String
  type          PlaceType
  service_id    Int?
  district_id   Int?
  address       String
  // Coordinates on the Terra Nova city plan (0–1000); lat/lng kept for a real basemap later
  map_x         Int?
  map_y         Int?
  latitude      Float?
  longitude     Float?
  phone         String?
  opening_hours String?
  is_24_7       Boolean   @default(false)
  is_emergency  Boolean   @default(false)
  accessibility String?   @db.Text
  is_active     Boolean   @default(true)

  service  CityService? @relation(fields: [service_id], references: [id], onDelete: SetNull)
  district District?    @relation(fields: [district_id], references: [id], onDelete: SetNull)

  @@index([type])
  @@index([is_emergency])
}
```

On ajoute aussi `map_x` et `map_y` (`Int?`) au modèle `TransitStop`, pour afficher les arrêts sur le plan et trouver l'arrêt le plus proche d'un lieu.

### 4.2 Endpoints

| Endpoint | Accès | Rôle |
|---|---|---|
| `GET /api/places?type=&emergency=&district_id=&service_id=&q=` | public | Liste filtrée des lieux |
| `GET /api/places/:id` | public | Détail d'un lieu, avec le service et le quartier |
| `POST /api/places`, `PATCH /api/places/:id`, `DELETE /api/places/:id` | admin | Gestion des lieux, avec une entrée d'audit (PLAN-10) |
| `GET /api/services/:idOrSlug` | public | Renvoie désormais aussi les `places` du service |
| `GET /api/search` | public | Inclut les lieux dans les résultats (F32) |

### 4.3 Données de démonstration

- **Lieux :** un lieu par service existant, plus les lieux suivants :
  - l'Hôpital de Terra Nova, avec des urgences ouvertes 24 h/24 ;
  - le centre de santé ;
  - 2 pharmacies, dont une de garde ;
  - la caserne des pompiers et le poste de police ;
  - la mairie et une mairie annexe ;
  - un abri de crise dans le quartier Sud, en lien avec l'alerte de montée des eaux (F29).
- **Positions :** les coordonnées sont réparties de façon cohérente dans les 5 quartiers du plan.
- **Numéros d'urgence :** le paramètre `emergency_numbers` (PLAN-00, B1) contient :
  - 15 pour le SAMU ;
  - 17 pour la police ;
  - 18 pour les pompiers ;
  - 112 pour le numéro européen ;
  - le standard de la mairie.

## 5. Front citoyen

### 5.1 Carte : `/ville/carte` (F45)

**Filtres**
- Puces à choix multiples : Urgences, Santé, Mairie et administration, Sécurité, Transports (arrêts du PLAN-06), Tous.
- « Ouvert maintenant » : `is_24_7`, ou horaires analysés quand ils suivent un format simple.
- « Près de chez moi » : les lieux de mon quartier passent en premier.

**Liste et plan synchronisés**
- La liste est à gauche, le plan à droite. Sur mobile, la liste vient en premier et le plan se déplie.
- Survoler ou placer le focus sur une carte de la liste met en évidence son repère.
- Cliquer sur un repère sélectionne la carte correspondante.
- Chaque type de lieu a son repère, avec une **forme et une icône** propres, jamais la couleur seule (F43).

**Fiche d'un lieu**
- Informations : nom, type, adresse, horaires, téléphone (lien `tel:`), accessibilité.
- Lien vers le service concerné, qui ouvre sa fiche.
- **« Comment y aller » :** l'arrêt le plus proche, calculé par distance sur le plan, et les lignes qui le desservent (PLAN-06).

**Adresse de la page**
- Les filtres et le lieu choisi sont dans l'URL, par exemple `/ville/carte?type=sante&lieu=12`.
- Le lien est partageable et sert au bouton « Voir sur la carte » des fiches service (PLAN-02).

**Composant `features/map/CityPlan.tsx`**
- C'est un SVG, avec `role="img"` et un `aria-label` qui résume ce qu'il montre.
- Les repères sont des `<button>` munis d'un `aria-label`.
- Le zoom et le déplacement se font avec des boutons + et −, la molette et les flèches du clavier.
- Les contours des quartiers sont partagés avec le back-office.

**Option 3D**
Si la scène 3D est active, choisir un lieu fait voler la caméra jusqu'au repère du quartier et allume un faisceau, comme pour un signalement.

### 5.2 Urgences : `/ville/urgences` (F46), toujours à un clic

**Où trouver le bouton « Urgences »**
- Il reste visible en permanence dans la `TopBar`.
- Il est aussi sur le sas, accessible **sans compte**.
- On le retrouve en raccourci sur l'accueil (PLAN-02) et en résultat de recherche pour « urgence », « hôpital » ou « médecin de garde ».

**Contenu de la page**
- En tête, les **numéros d'urgence** en gros boutons d'appel (`tel:15`, etc.).
- Puis les **hôpitaux et services d'urgence ouverts maintenant**, triés de mon quartier vers les plus éloignés. Chacun affiche son téléphone, son adresse et « Ouvert 24 h/24 ».
- Un mini-plan avec les mêmes repères.
- L'alerte sanitaire en cours, s'il y en a une (PLAN-04).

**Règles**
La page tient en un seul écran, sans connexion obligatoire ni étape intermédiaire. Elle doit rester utilisable en « affichage simple » et à 400 % de zoom.

### 5.3 Lieu d'un signalement (PLAN-03, optionnel)

Le formulaire de signalement peut proposer de choisir le lieu sur le plan. Le point choisi est envoyé dans `data.map_point` (`{ x, y }`) et affiché à l'agent dans la page Signalements.

## 6. Back-office

- **Nouvelle page `/admin/lieux`** (menu « Contenus › Lieux & carte », F45/F46) :
  - une liste filtrable, accompagnée du plan ;
  - la création et la modification se font dans un tiroir ;
  - on place le repère **en cliquant sur le plan** ;
  - on peut lier le lieu à un service, et cocher « Urgence » et « 24 h/24 ».
- **Fiche service (`ServicesPage`) :** une section « Lieux d'accueil » dans le tiroir liste les lieux du service, avec un lien vers la page Lieux.
- **Signalements (`ReportsPage`, PLAN-03) :** les signalements qui ont un point sur le plan s'affichent sur le même plan.
- **Arrêts (`/admin/transports`, PLAN-06) :** chaque arrêt peut aussi être placé sur le plan.

## 7. Étapes

- [ ] Backend : modèle `Place`, `map_x`/`map_y` sur `TransitStop`, migration, endpoints, `places` dans la fiche service, lieux dans la recherche
- [ ] Seed : lieux et coordonnées ; paramètre `emergency_numbers`
- [ ] `src/api/places.ts`, plus `features/map/` : `CityPlan`, la géométrie des quartiers et les repères
- [ ] `/ville/carte`
- [ ] `/ville/urgences`, et le bouton « Urgences » dans la `TopBar` et sur le sas
- [ ] « Voir sur la carte » sur les fiches service ; « Comment y aller » relié aux arrêts
- [ ] Back-office : `/admin/lieux`, section « Lieux d'accueil » dans `ServicesPage`, placement des arrêts

## 8. Critères d'acceptation

1. **F45.**
   - Depuis la fiche d'un service ou depuis la carte, l'habitant obtient en deux clics au plus : l'adresse, la position sur le plan, les horaires et l'arrêt le plus proche.
   - Les mêmes informations restent accessibles sous forme de liste, au clavier et au lecteur d'écran.
2. **F46.**
   - Depuis n'importe quelle page, y compris le sas sans compte, le bouton « Urgences » affiche en un seul écran les numéros d'urgence et les hôpitaux ou services d'urgence ouverts.
   - Les numéros de téléphone sont cliquables.
3. **Administration.** L'admin ajoute un lieu en cliquant sur le plan, et ce lieu apparaît ensuite côté habitant.

## 9. Version minimale

À livrer en premier :
- le modèle `Place`, les endpoints de lecture et le seed ;
- la page `/ville/urgences` et le bouton « Urgences » ;
- `/ville/carte` avec la liste, le plan et les filtres par type.

Peuvent attendre : « Comment y aller », la page `/admin/lieux` (le seed suffit pour la démo), le vol de caméra en 3D et le choix d'un point de signalement sur le plan.
