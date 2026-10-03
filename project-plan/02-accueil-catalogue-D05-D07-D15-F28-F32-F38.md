# PLAN-02 : accueil, navigation et catalogue des services

> **Réfs :** D05 · D07 · D15 · F28 · F32 · F38. **XP :** 2 170.
> **Dépend de :** PLAN-00 ; PLAN-01 pour les blocs réservés aux personnes connectées.
> **Débloque :** PLAN-03 (démarrer une démarche depuis une fiche), PLAN-05 (prendre rendez-vous), PLAN-07 (lieux) et PLAN-09.
> **Effort :** ≈ 5 h.

## 1. Pourquoi ces demandes vont ensemble

L'habitant arrive sur l'accueil (D07), qui présente en priorité les services mis en avant (F28) du catalogue (D05). Il cherche un service (F32) et doit toujours savoir où il se trouve (D15).

Quand un service est interrompu (F38), cela doit se voir partout où il apparaît : accueil, catalogue, fiche, recherche. L'habitant doit le savoir avant de commencer une démarche ou de prendre rendez-vous.

Ces demandes reposent toutes sur les mêmes données (`/api/home`, `/api/services`, `/api/service-interruptions`) et sur les mêmes composants (carte de service, pastille de disponibilité).

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| D05 | Mairie | Présenter clairement les services et l'information utile de chacun | Catalogue par catégorie et fiches complètes |
| D07 | Mairie | Comprendre tout de suite où l'on est et ce qu'on peut faire | Accueil hiérarchisé, avec les accès principaux visibles sans faire défiler |
| D15 | Citoyen | Savoir où l'on se trouve et revenir aux niveaux précédents | Fil d'Ariane sur toutes les pages, rubrique active signalée |
| F28 | Mairie | Mettre en avant les services prioritaires ou les plus utilisés | Les services marqués d'une étoile par l'admin passent en tête de l'accueil |
| F32 | Citoyenne | Trouver vite, par exemple les services de santé | Recherche tolérante aux synonymes, résultats groupés par type |
| F38 | Citoyen | Savoir qu'un service est indisponible avant de commencer, et quand revenir | Pastille et encart de disponibilité partout, action bloquée avec une explication |

## 2. Existant

### Backend (prêt)

- `GET /api/home` renvoie :
  - `alerts`, avec `concerns_me` pour chaque alerte ;
  - `service_disruptions` et `transit_disruptions` ;
  - `featured_services`, avec leur `availability` ;
  - `categories` et `announcements` ;
  - `me`, si une personne est connectée : `unread_notifications`, `open_requests`, `next_appointment`.
- Services :
  - `GET /api/services?category=&featured=&q=&sort=` (`include_inactive=true` pour le personnel) ;
  - `GET /api/services/:idOrSlug`, qui incrémente `view_count` ;
  - `GET /api/service-categories`.
- Démarches : `GET /api/procedures?service_id=`, et `POST/PATCH/DELETE /api/procedures` pour les admins.
- Recherche : `GET /api/search?q=` renvoie les services, les démarches, les annonces et, si une personne est connectée, ses demandes.
- Interruptions : `GET /api/service-interruptions?scope=current|upcoming|active|all`. Le personnel a en plus la création, la modification, `POST /:id/end` et la suppression.
- Une demande ou un rendez-vous sur un service interrompu est refusé : `409 SERVICE_UNAVAILABLE`, avec `reason`, `alternative` et `back_at`.

### Front citoyen

- `features/services/ServiceList.tsx` affiche 5 services écrits en dur.
- Le survol 3D comporte 6 sections, chacune liée à une pose de caméra (`pages/CityPage/citySections.ts`).
- Il n'y a ni recherche, ni catalogue, ni fil d'Ariane.

### Back-office

`ServicesPage` (étoile, priorité, actif ou non, édition) et `MaintenancePage` (frise sur 7 jours, création, fin d'interruption) sont simulées par `catalogStore`.

## 3. Backend

Rien de bloquant. Petits ajouts :

- **Seed : mots-clés (F32).** Remplir `keywords` avec des synonymes. Pour la santé, par exemple : « médecin, docteur, hôpital, soins, urgence, vaccin, consultation, infirmier ». Il en faut au moins 5 par service.
- **Compteur de vues (F28, optionnel).** Ne pas incrémenter `view_count` quand c'est le personnel qui consulte, pour que « les plus utilisés » reflète bien les habitants.
- **Paramètres.** `home_blocks` et `maintenance_banner` viennent de PLAN-00 (B1).

## 4. Front citoyen

### 4.1 Accueil : le survol `/ville` (D07, F28, F38)

Chaque section reste liée à sa pose de caméra : on ne change pas leur ordre, sinon le film ne suit plus. Leur contenu devient réel grâce à `useHome()` (`GET /api/home`, rafraîchi toutes les 60 s).

| Section (repère 3D) | Contenu |
|---|---|
| Arrivée | Message de bienvenue, puis **les alertes qui me concernent** (PLAN-04). Ensuite les raccourcis, dans l'ordre fixé par `home_blocks` : Signaler, Mes demandes, Prendre rendez-vous, Transports, Urgences (PLAN-07). Enfin les compteurs `me` : demandes ouvertes, prochain rendez-vous, notifications. |
| Services (Dôme central) | Les `featured_services` (F28), chacun avec sa pastille de disponibilité (F38). Des pastilles de catégories et un lien « Tous les services » vers `/ville/services`. |
| Signaler (Dôme 3) | Voir PLAN-03. |
| État de la ville (Serre 1) | Les jauges simulées restent (hors périmètre). S'y ajoute **la liste réelle des perturbations** : `service_disruptions` (F38) et `transit_disruptions` (F36), chacune avec son heure de retour prévue. |
| Haut Conseil | Annonces (PLAN-04). |
| Registre | Voir PLAN-10. |

- La barre du haut garde ses liens et gagne :
  - « Services » ;
  - **Rechercher** (F32) ;
  - « Mon espace » (PLAN-01) ;
  - « Urgences » (PLAN-07).
- Le bandeau `maintenance_banner` s'affiche quand il est activé.
- Les textes « Exemples de services… » et « Maquette de démonstration, données simulées » disparaissent.

### 4.2 Catalogue `/ville/services` (D05, F32)

- Pastilles de catégories (`GET /api/service-categories`) et recherche dans le catalogue (`q`).
- L'ordre est celui du backend : services mis en avant, puis priorité, puis nombre de consultations.
- Chaque carte de service affiche :
  - le nom, le résumé et la catégorie ;
  - la disponibilité : « Ouvert », « Perturbé jusqu'à 14:00 » ou « Indisponible », toujours sous forme de texte et d'icône, jamais par la seule couleur ;
  - un contact rapide.
- Les filtres sont reportés dans l'URL (`?categorie=sante&q=…`), pour pouvoir partager la page et y revenir.

### 4.3 Fiche service `/ville/services/:slug` (D05, F38)

- Description, horaires, adresse, téléphone (lien `tel:`), e-mail et site externe.
- Un lien « Voir sur la carte », quand le PLAN-07 est livré.
- Un encart **Disponibilité** (`AvailabilityNotice`) :
  - le motif de l'interruption ;
  - le retour prévu, écrit en clair (« mardi 7 octobre à 14:00 ») ;
  - l'alternative (« En attendant : … ») ;
  - les interruptions à venir.
- Les démarches du service (`GET /api/procedures?service_id=`), qui mènent à `/ville/demarches/:slug` (PLAN-03).
- Un bouton « Prendre rendez-vous » quand le service propose des créneaux (PLAN-05).
- Si le service est indisponible, « Commencer » et « Prendre rendez-vous » sont désactivés **avec l'explication affichée à côté**. Un bouton grisé sans raison ne suffit pas.

### 4.4 Recherche `/ville/recherche?q=` (F32)

- Le champ est dans la barre du haut ; la touche `/` y place le curseur.
- Les résultats sont groupés : Services, Démarches, Annonces et, si l'on est connecté, Mes demandes. Chaque groupe affiche son nombre de résultats, et le terme cherché est mis en évidence.
- Sans résultat, la page propose les catégories et « Écrire à la mairie » (PLAN-03, D04).
- La recherche part 250 ms après la dernière frappe. Le nombre de résultats est annoncé aux lecteurs d'écran (`aria-live`), par exemple « 6 résultats ».
- Après le PLAN-07, les lieux apparaissent aussi dans les résultats.

### 4.5 Fil d'Ariane et repères (D15)

- `ConsoleLayout` (PLAN-00) affiche par exemple « Accueil › Services › Santé › Centre de santé ».
  - Chaque route déclare son libellé dans `handle.crumb`.
  - Les libellés qui dépendent des données sont lus dans le cache de la requête de la page.
- Balisage : `<nav aria-label="Fil d'Ariane">`, chaque niveau est un lien, et le dernier porte `aria-current="page"`.
- La rubrique active est mise en évidence dans la barre du haut.
- Le bouton « Retour » suit l'historique de navigation.
- Chaque page a son propre titre de document.
- Sur le survol, le rail existant (`RouteRail`) indique déjà la position et reste tel quel.

### 4.6 Composants à créer

- Dans `features/services/` : `ServiceCard`, `AvailabilityPill` et `AvailabilityNotice`. `AvailabilityNotice` sert aussi aux erreurs `409 SERVICE_UNAVAILABLE` des plans 03 et 05.
- Dans `features/search/` : `SearchBox` et `SearchResults`.
- Dans `ui/` : `Breadcrumbs`.
- `ServiceList.tsx` et `services.ts`, avec leurs données en dur, sont supprimés.

## 5. Back-office

| Page | Lecture | Actions |
|---|---|---|
| `ServicesPage` (D05, F28) | `GET /api/services?include_inactive=true&limit=100` et `GET /api/service-categories` | Étoile, priorité, actif, édition : `PATCH /api/services/:id`. Bouton « Nouveau service » : `POST /api/services`. L'aperçu « Ordre sur la page d'accueil » applique le même tri que `GET /api/home`. |
| `ServicesPage`, onglet « Démarches » du panneau d'édition (D05, D11) | `GET /api/procedures?service_id=` | Créer ou modifier une démarche : titre, description, documents requis, délai estimé, champs du formulaire (`form_schema`). Les champs se saisissent dans un éditeur simple : nom, libellé, type (`text`, `textarea`, `date`, `number`, `select` avec ses options), obligatoire ou non. Enregistrement par `POST` ou `PATCH /api/procedures`. |
| `MaintenancePage` (F38) | `GET /api/service-interruptions?scope=all` | Créer : `POST`. Modifier : `PATCH /:id`. « Terminer maintenant » : `POST /:id/end`. Supprimer : `DELETE /:id`. |
| `SettingsPage` (D07) | `GET /api/settings` | Ordre et visibilité des blocs `home_blocks`, bandeau `maintenance_banner`. |
| Badge `interruptions` du menu | `GET /api/service-interruptions?scope=current`, puis le nombre de résultats | — |

`stores/catalogStore.ts` et `mocks/catalog.ts` sont supprimés. Le contenu de `mocks/catalog.ts` sert d'abord à enrichir le seed.

## 6. Étapes

- [ ] Seed : mots-clés et synonymes ; en option, exclure le personnel du compteur de vues
- [ ] `src/api/home.ts`, `services.ts`, `procedures.ts`, `search.ts`, `interruptions.ts`
- [ ] Composants `AvailabilityPill`, `AvailabilityNotice` et `ServiceCard`
- [ ] Survol : sections Arrivée, Services et État de la ville branchées sur `useHome()` ; raccourcis ; bandeau de maintenance
- [ ] `/ville/services` et `/ville/services/:slug`
- [ ] `/ville/recherche` et le champ de recherche dans la barre du haut
- [ ] `Breadcrumbs` et le `handle.crumb` de chaque route `/ville/*`
- [ ] Back-office : `ServicesPage` (dont l'onglet Démarches), `MaintenancePage`, blocs de la `SettingsPage`, badge
- [ ] Suppression de `ServiceList`, `services.ts` et `catalogStore`

## 7. Critères d'acceptation

1. **D07.** En arrivant, sans faire défiler, on voit : les alertes qui me concernent, 4 ou 5 raccourcis et les services mis en avant.
2. **D05.** Le catalogue liste tous les services actifs, par catégorie. Chaque fiche donne le contact, les horaires, l'adresse et les démarches.
3. **F28.** L'admin met « Prévention santé » en avant : il passe en tête de l'accueil après le rafraîchissement suivant (60 s au plus).
4. **F32.**
   - « médecin », « santé » et « vaccin » trouvent le centre de santé et la prévention.
   - « zzz » ne trouve rien et propose les catégories et le contact de la mairie.
5. **D15.** Sur toute page hors survol, le fil d'Ariane est cliquable au clavier, et le niveau courant est annoncé par les lecteurs d'écran.
6. **F38.**
   - L'admin déclare une interruption de « État civil » jusqu'à 14:00.
   - La pastille « Indisponible » apparaît sur l'accueil, dans le catalogue, sur la fiche et dans la recherche, avec le retour prévu et l'alternative.
   - « Commencer la démarche » est désactivé, avec son explication.
   - Si l'on force l'envoi, l'erreur `409` s'affiche de la même façon.

## 8. Version minimale

À faire en priorité :
- l'accueil branché : services mis en avant et perturbations ;
- le catalogue et la fiche, avec la disponibilité ;
- une recherche simple ;
- le fil d'Ariane ;
- `MaintenancePage` et `ServicesPage`.

L'éditeur de formulaire des démarches (`form_schema`) et les blocs configurables de l'accueil passent en dernier.
