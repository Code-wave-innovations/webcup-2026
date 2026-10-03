# BO-06 : catalogue, accueil et disponibilité des services

> **Rôle :**
> - Admin : catalogue, démarches, mise en avant, accueil, coupure d'urgence.
> - Agent : déclarer et terminer une interruption, comme le backend l'autorise déjà au personnel.
>
> **Réfs :** D05 · D07 · F28 · F38 · F63 · F64. **XP :** 3 060.
> **Dépend de :** BO-00. Le BO-03 est recommandé, pour l'historique des services.
> **Pendant citoyen :** PLAN-02 de `project-plan/`. F63 et F64 n'y sont pas encore planifiés.
> **Effort :** ≈ 4 h.

## 1. Pourquoi ces réfs vont ensemble

Toutes ces demandes portent sur **ce que l'admin règle pour qu'un habitant trouve le bon service et sache s'il fonctionne**. La donnée est la même : `CityService`, ses `Procedure`, ses `ServiceInterruption`, et les paramètres de l'accueil.

F63 (couper un service) et F64 (voir son état avant de commencer) sont les deux faces d'une même interruption : l'une la crée, l'autre l'affiche.

| Réf | Demandeur | Besoin | Ce que le back-office doit permettre |
|---|---|---|---|
| D05 | Mairie | Présenter clairement les services et leurs informations utiles | Éditer chaque service (résumé, contacts, horaires, mots-clés) et ses démarches |
| D07 | Mairie | Un accueil qui hiérarchise l'essentiel | Ordonner et masquer les blocs de l'accueil, avec un aperçu |
| F28 | Mairie | Mettre en avant les services prioritaires ou les plus utilisés | Étoile, priorité, aperçu de l'ordre sur l'accueil, nombre de consultations |
| F38 | Citoyen | Savoir qu'un service est interrompu avant de commencer, quand revenir, quoi faire à la place | Déclarer une maintenance ou un incident, avec son impact, son motif, une alternative et une date de retour |
| F63 | Centre technique | Les admins désactivent **rapidement** un service défectueux ; l'habitant voit ce qui marche, ce qui ne marche pas, et la prochaine action | Le bouton « Couper le service » : 3 clics, motif et alternative, effet immédiat |
| F64 | Citoyen | Voir l'état actuel d'un service avant de commencer | Le tableau « État des services » et l'aperçu de ce que voit l'habitant |

## 2. Écrans et état actuel

| Écran | Route | Aujourd'hui |
|---|---|---|
| `ServicesPage` | `/admin/services` | `catalogStore.updateService`, `mocks/catalog` |
| `MaintenancePage` | `/admin/maintenance` | `addInterruption`, `endInterruption` |
| `SettingsPage`, section Accueil | `/admin/parametres` | Branchée sur `plan-00` (`home_blocks`, `maintenance_banner`) |
| Badge `interruptions` | Menu | `catalogStore` |

**Backend prêt :**
- **Services :**
  - `GET /api/services?category=&featured=&q=&sort=&include_inactive=` ;
  - chaque service porte `availability` : `status` (`AVAILABLE`, `DEGRADED` ou `UNAVAILABLE`), `back_at` et `upcoming` ;
  - `POST`, `PATCH` et `DELETE /api/services`, réservés aux admins.
- **Catégories et démarches :** `GET /api/service-categories` et `GET /api/procedures?service_id=`, avec écriture réservée aux admins.
- **Interruptions :**
  - `GET /api/service-interruptions?scope=current|upcoming|active|all` ;
  - `POST`, `PATCH /:id`, `POST /:id/end` et `DELETE /:id`, ouverts au personnel ;
  - une interruption `UNAVAILABLE` prévient déjà les habitants qui ont un rendez-vous sur la période, et la réponse renvoie `notified`.
- **Blocage :** créer une demande ou un rendez-vous sur un service indisponible renvoie `409 SERVICE_UNAVAILABLE`, avec `reason`, `alternative` et `back_at`.

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| F63 : connaître l'impact avant de couper | `GET /api/services/:id/impact`, réservé au personnel : `{ upcoming_appointments, open_requests, open_procedures }` |
| F63 : réserver la coupure immédiate aux admins, en une action | `POST /api/services/:id/disable { reason, alternative?, back_at?, notify_open_requests? }`, réservé aux admins. Il crée une `ServiceInterruption` (`type: INCIDENT`, `impact: UNAVAILABLE`, `starts_at: now`, `ends_at: back_at ?? null`) avec la logique de prévenance existante. Avec `notify_open_requests`, il prévient aussi les auteurs des demandes ouvertes sur ce service. Audit : `service.disabled`. |
| F63 : rétablir en une action | `POST /api/services/:id/enable`, réservé aux admins : termine les interruptions en cours du service (`ends_at = now`). Audit : `service.enabled`. |
| Différence entre « couper » et « retirer » | `is_active: false` **retire** un service du catalogue : il devient invisible pour l'habitant. Ce n'est **pas** F63, qui garde le service visible et affiche « Indisponible ». L'interface le dit (§ 4.1). |
| F28 : le tri de l'accueil n'est pas visible côté admin | `GET /api/home` applique déjà le tri. L'aperçu de l'admin l'appelle tel quel, pour montrer exactement ce que voit l'habitant. |

## 4. Branchement écran par écran

Fichiers front :
- `src/api/services.ts` : `useServices`, `useUpdateService`, `useCreateService`, `useServiceImpact`, `useDisableService`, `useEnableService` ;
- `src/api/procedures.ts` ;
- `src/api/interruptions.ts`.

### 4.1 `ServicesPage` (D05, F28, F63, F64)

**Lecture :** `GET /api/services?include_inactive=true&limit=100` et `GET /api/service-categories`.

**Colonnes de la liste :**
- nom et catégorie ;
- **état** (pastille avec icône et mot : « Disponible », « Perturbé » ou « Indisponible jusqu'à 14:00 ») ;
- mise en avant (étoile) ;
- priorité ;
- consultations (`view_count`) ;
- actif (dans le catalogue).

**Actions**

| Fonction simulée ou nouveauté | Appel |
|---|---|
| `updateService` (étoile, priorité, actif) | `PATCH /api/services/:id`. Mise à jour optimiste avec retour en arrière (BO-00). |
| Édition dans le tiroir | `PATCH`, avec : nom, résumé, description, mots-clés de recherche (F32), contacts, adresse, horaires, lien externe |
| « Nouveau service » | `POST /api/services` |
| « Retirer du catalogue » (`is_active: false`) | Confirmation : « Le service disparaîtra pour les habitants. Pour une panne, utilisez plutôt Couper le service. » |
| **« Couper le service » (F63)**, admin | Voir le détail ci-dessous |

**Coupure en 3 clics (F63)**
1. Clic sur « Couper le service », dans la ligne, dans le tiroir ou dans la palette ⌘K (« Couper un service… »).
2. Une `Modal` s'ouvre :
   - elle affiche l'impact (`GET /:id/impact`) : « 3 rendez-vous à venir seront prévenus, 5 demandes sont ouvertes » ;
   - elle demande un motif (obligatoire, avec des modèles : « Panne technique », « Incident en cours ») ;
   - elle propose une alternative (pré-remplie avec le téléphone du service) ;
   - elle propose une heure de retour estimée (facultative) ;
   - une case « Prévenir aussi les demandes ouvertes ».
3. Clic sur « Couper maintenant », qui appelle `POST /:id/disable`.

Ensuite :
- un toast confirme « État civil coupé · 3 habitants prévenus » ;
- l'état devient « Indisponible » partout ;
- le bouton devient « Rétablir le service » (`POST /:id/enable`).

**Onglets du tiroir**

| Onglet | Contenu |
|---|---|
| Informations | Les champs du service |
| Démarches (D05) | `GET /api/procedures?service_id=`. Création et modification : titre, description, documents requis, délai estimé, champs du formulaire (`form_schema`), saisis dans un éditeur simple : nom, libellé, type (`text`, `textarea`, `date`, `number`, `select` avec ses options), obligatoire ou non. |
| État et interruptions (F38, F64) | L'interruption en cours et celles à venir, plus un lien vers Interruptions |
| Aperçu habitant (F64) | La carte d'état telle qu'elle apparaît sur la fiche du service : « Indisponible depuis 10:20 · Retour prévu à 14:00 · En attendant : appelez le 01 23 45 67 89 » |
| Lieux | Ajouté par le BO-09 |
| Historique | Ajouté par le BO-03 |

**Aperçu « Ordre sur l'accueil » (F28) :** le résultat de `GET /api/home` (`featured_services`), affiché comme sur l'accueil. Il est rafraîchi après chaque changement d'étoile ou de priorité.

### 4.2 `MaintenancePage` (F38)

**Lecture :** `GET /api/service-interruptions?scope=all`. Une frise montre les interruptions en cours et à venir.

**Actions**

| Fonction simulée | Appel |
|---|---|
| `addInterruption` | `POST` avec type (maintenance ou incident), impact (perturbé ou indisponible), motif, alternative, début et fin. Après l'envoi, toast « … · N habitants prévenus », à partir de `notified`. |
| Modifier | `PATCH /:id` |
| `endInterruption` | `POST /:id/end` |
| Supprimer | `DELETE /:id`, réservé aux interruptions à venir |

**Erreurs :** une fin avant le début est refusée, avec l'erreur sur le champ.

### 4.3 État des services (F64)

- **Bloc « État des services »** dans la vue globale (BO-02) et en tête de `MaintenancePage` :
  - le nombre de services disponibles, perturbés et indisponibles ;
  - la liste de ceux qui ne sont pas disponibles, avec leur heure de retour.
- **Badge `interruptions` du menu :** nombre de résultats de `GET /api/service-interruptions?scope=current`.

### 4.4 `SettingsPage`, section Accueil (D07)

- Elle est déjà branchée sur `plan-00`.
- À ajouter : un aperçu schématique de l'accueil dans l'ordre choisi des `home_blocks`, avec les blocs masqués grisés.
- Le bandeau `maintenance_banner` s'affiche dans l'aperçu.

## 5. Nettoyage

Sont supprimés :
- `stores/catalogStore.ts` ;
- `mocks/catalog.ts`, dont le contenu est déjà dans le seed de `plan-00`.

## 6. Étapes

- [ ] Backend : `GET /:id/impact`, `POST /:id/disable` et `/enable` (admin, audités)
- [ ] `src/api/services.ts`, `procedures.ts`, `interruptions.ts`
- [ ] `ServicesPage` : liste avec l'état, bascules optimistes, tiroir (informations, démarches, état, aperçu habitant), nouveau service
- [ ] Coupure en 3 clics et rétablissement, plus l'action dans la palette ⌘K
- [ ] `MaintenancePage` sur la frise réelle, avec le nombre de personnes prévenues
- [ ] Bloc « État des services » et badge `interruptions`
- [ ] Aperçu de l'accueil dans Paramètres
- [ ] Nettoyage

## 7. Critères d'acceptation

1. **F63.**
   - `admin@` coupe « État civil » en 3 clics, en moins de 30 s, avec un motif et une alternative.
   - Côté habitant, la fiche du service affiche aussitôt « Indisponible », le motif, l'alternative et l'heure de retour.
   - Une démarche sur ce service est refusée avec le même message.
   - Les habitants qui ont un rendez-vous reçoivent une notification.
   - « Rétablir » rend le service disponible.
   - L'audit contient `service.disabled` et `service.enabled`.
2. **F64.** L'état est le même à trois endroits : la liste des services, le bloc « État des services » et l'aperçu habitant.
3. **F38.**
   - `agent@` déclare une maintenance pour demain, de 08:00 à 12:00. Elle apparaît « à venir » sur la frise.
   - L'habitant voit « Maintenance prévue demain de 08:00 à 12:00 » sur la fiche du service.
4. **F28.** Mettre « Centre de santé » en avant et lui donner la priorité la plus haute le fait passer en premier dans l'aperçu de l'accueil, puis sur `/ville`.
5. **D05.** Une démarche créée avec deux champs obligatoires apparaît côté habitant. Un envoi sans ces champs est refusé.
6. **D07.** Masquer le bloc « Annonces » dans Paramètres le retire de l'accueil de l'habitant.

## 8. Version minimale

À faire en premier :
- la liste des services avec l'état ;
- l'étoile et la priorité ;
- la coupure et le rétablissement (F63) ;
- `MaintenancePage` branchée.

Peut attendre :
- l'éditeur de `form_schema` ;
- l'aperçu de l'accueil ;
- la prévenance des demandes ouvertes.

## 9. Points d'attention

- **Désactiver n'est pas couper.** Ne pas implémenter F63 avec `is_active: false` : le service disparaîtrait, et l'habitant ne saurait ni pourquoi, ni quoi faire (le contraire de F63 et F64).
- **Heure de retour :** `back_at` est affiché avec le fuseau du serveur (`TZ`), comme les rendez-vous.
