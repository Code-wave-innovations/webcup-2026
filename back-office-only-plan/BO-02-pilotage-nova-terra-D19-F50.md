# BO-02 : pilotage de l'activité et API Nova Terra

> **Rôle :** Agent (tableau de bord, flux Nova Terra) et Admin (vue globale).
> **Réfs :** D19 · F50. **XP :** 1 740.
> **Dépend de :**
> - BO-00 ;
> - BO-01, pour les statistiques des demandes ;
> - BO-03, pour le flux d'activité.
>
> Les encarts « Alertes » et « Services perturbés » attendent le BO-07 et le BO-06.
> **Pendant citoyen :** le `RegistryPanel` du PLAN-10.
> **Effort :** ≈ 4 h.

## 1. Pourquoi ces réfs vont ensemble

Les deux demandes portent sur le **suivi global de l'activité depuis l'espace de travail**. Elles se jouent sur les deux tableaux de bord et la page Nova Terra.

| Réf | Demandeur | Besoin | Ce que le back-office doit montrer |
|---|---|---|---|
| D19 | Direction du Numérique | Un espace de travail distinct de l'espace citoyen, qui affiche clairement les informations de l'API Nova Terra et permet de suivre l'activité dès la mise en service | L'espace distinct existe déjà (BO-00). Ici : la page Nova Terra sur le vrai flux, un encart Nova Terra et des indicateurs d'activité réels. |
| F50 | Direction des Services Municipaux | Un tableau de bord **simplifié** pour suivre l'activité, facile à retrouver et clair au quotidien | Une « Vue simple » des deux tableaux de bord : peu d'indicateurs, écrits en phrases, comparés à la période précédente, chacun menant à la liste concernée |

## 2. Écrans et état actuel

| Écran | Route | Aujourd'hui |
|---|---|---|
| `AgentDashboardPage`, encart « Nova Terra — vague N » | `/agent` | `mocks/terraNova` (payload figé de la vague 5) |
| `NovaTerraPage` | `/agent/nova-terra` | `mocks/terraNova`, `mocks/time` |
| `AdminOverviewPage` | `/admin` | `mocks/stats` (`REQUEST_TREND`, `ACTIVITY_HEATMAP`, `SPARKS`), chiffres multipliés (`citizens.length * 124`), stores de demandes, de contenus, de catalogue et d'audit |
| `shared/TerraNovaCard` | — | Typée par `mocks/types` |

**Backend prêt :**
- `GET /api/terra-nova/requests`, réservé au personnel :
  - cache de 60 s, et `?refresh=true` pour forcer la mise à jour ;
  - la clé est envoyée en `X-Webcup-Api-Key` côté serveur uniquement ;
  - la réponse contient `session` (`current_wave`, `minutes_until_next_wave`, `visible_requests_count`…) et `requests`, avec `request_code`, `group_name`, `difficulty`, `xp_total`, `wave_number`… ;
  - le flux actuel compte 67 demandes, à la vague 12.
- `GET /api/dashboard/stats` : voir le BO-01.

## 3. Backend : ce qui manque

### 3.1 Tendances (D19)

`GET /api/dashboard/trends?days=14`, réservé au personnel, renvoie :
- `daily` : par jour, les demandes créées et résolues, par type ;
- `median_pickup_hours` : délai médian entre `SUBMITTED` et la première prise en charge (premier événement `ASSIGNED` ou `STATUS_CHANGED`) ;
- `pickup_by_service` : délai médian par service, qui remplace `HANDLING_TIME` ;
- `heatmap` : une grille jour × tranche de 2 h des créations de demandes et des actions du personnel (`AuditLog`, BO-03).

### 3.2 Résumé pour la vue simple (F50)

`GET /api/dashboard/summary?period=today|7d|30d`, réservé au personnel :

```jsonc
{
  "period": { "from": "…", "to": "…", "previous_from": "…", "previous_to": "…" },
  "indicators": {
    "requests_received":   { "value": 23, "previous": 18 },
    "requests_resolved":   { "value": 17, "previous": 19 },
    "awaiting_pickup":     { "value": 4,  "previous": null },   // instantané (D17)
    "overdue":             { "value": 2,  "previous": null },
    "median_pickup_hours": { "value": 6,  "previous": 9 },
    "appointments":        { "value": 31, "previous": 27, "no_show": 2 },
    "new_citizens":        { "value": 12, "previous": 9 }
  },
  "watch": [   // au plus 5 éléments, du plus grave au moins grave
    { "kind": "overdue_request", "label": "NT-…-4F9A2C attend depuis 4 j", "link": "/agent/demandes/12" },
    { "kind": "service_unavailable", "label": "État civil indisponible depuis 10:20", "link": "/admin/maintenance" },
    { "kind": "active_alert", "label": "Montée des eaux · quartier Sud", "link": "/admin/alertes" }
  ]
}
```

- Les libellés de `watch` sont produits par le serveur, pour être identiques partout.
- Les phrases des indicateurs sont construites par le front.
- Pour un agent, `link` pointe vers `/agent/...` quand l'écran existe dans son espace. Sinon, l'élément n'a pas de lien.

### 3.3 Registre de livraison (facultatif, bonus jury)

Modèle `FeatureDelivery` et `PUT /api/terra-nova/deliveries/:code`, tels que décrits dans `project-plan/10-…md` § 3.3. Ils permettent de marquer chaque demande comme planifiée, en cours ou livrée, avec son plan (BO-NN ou PLAN-NN) et la route où la vérifier.

## 4. Branchement écran par écran

Fichiers front :
- `src/api/terraNova.ts` (`useTerraNovaFeed`, `useRefreshTerraNova`, `useUpdateDelivery`) ;
- `src/api/dashboard.ts` (`useDashboardTrends`, `useDashboardSummary`).

### 4.1 `NovaTerraPage` (D19)

**Lecture :** `GET /api/terra-nova/requests`, toutes les 60 s.

**Bouton « Actualiser » :** `?refresh=true`. Le bouton est désactivé pendant l'appel.

**Bandeau de session :**
- la vague en cours ;
- le nombre de demandes visibles ;
- un compte à rebours jusqu'à la vague suivante, calculé à partir de `minutes_until_next_wave` et recalé à chaque réponse. Utiliser `useNow()`, jamais `Date.now()` pendant le rendu.

**Cartes (`TerraNovaCard`) :**
- code, demandeur et type de demandeur ;
- message ;
- difficulté (texte et icône, pas seulement une couleur) ;
- XP et vague ;
- plan qui couvre la demande. La correspondance code → plan vit dans un fichier `terraNovaPlans.ts`, reprise des index de `project-plan/` et de ce dossier. Elle est remplacée par `FeatureDelivery` si le § 3.3 est fait.

**Filtres :** groupe (`group_name`), difficulté, vague, « nouvelles depuis ma dernière visite » (dernière vague vue, gardée dans le `localStorage` avec try/catch).

**Nouvelle vague :** quand `current_wave` augmente, toast « Nouvelle vague 13 : N demandes », et les nouvelles cartes s'éclairent brièvement.

**Erreurs :**
- `503`, clé absente : « Flux Nova Terra non configuré (clé manquante côté serveur) ».
- `502`, API injoignable : « Flux Nova Terra indisponible : dernière mise à jour à … ». Les dernières données restent affichées.

### 4.2 `AgentDashboardPage`, encart Nova Terra et vue simple

- **Encart Nova Terra :** la vague, le compte à rebours et les 3 demandes les plus récentes, qui mènent à la page Nova Terra.
- **Bascule « Vue simple / Vue détaillée »** dans l'en-tête (§ 5). Le choix est gardé dans le `localStorage`.
- **Vue simple pour un agent :** les indicateurs `awaiting_pickup`, `overdue`, `requests_received`, `requests_resolved` et `appointments`, plus la liste « À surveiller ».

### 4.3 `AdminOverviewPage` (D19, F50)

| Élément du design | Source |
|---|---|
| Tuile « Citoyens inscrits » | `stats.platform.citizens`, avec la tendance de `summary.new_citizens` |
| Tuile « Demandes à traiter » | `stats.requests.needs_action` |
| Tuile « Résolues cette semaine » | `summary(7d).requests_resolved`, avec l'écart réel par rapport à la semaine précédente |
| Tuile « Délai moyen de prise en charge » | `summary(7d).median_pickup_hours`. Le libellé devient « Délai médian » : c'est la mesure exacte. |
| Graphique « Demandes reçues et résolues » (`AreaTrend`) | `trends.daily` |
| Anneau « Types de demandes » | `stats.requests.open_by_type` |
| Carte de chaleur | `trends.heatmap` |
| Barres « Par statut » | `stats.requests.by_status` |
| Encart « Alertes et services perturbés » | `GET /api/alerts/active` (BO-07) et `GET /api/service-interruptions?scope=current` (BO-06) |
| Flux d'audit en direct | BO-03 |

Les mini-courbes (`SPARKS`) des tuiles sont remplacées par les séries de `trends.daily`. Si une série manque, la tuile s'affiche sans courbe : jamais avec une courbe inventée.

## 5. Vue simple (F50)

Objectif : comprendre l'activité en 10 secondes, sans lire un graphique.

- **Six indicateurs au plus**, chacun sur une ligne :
  > **4 demandes attendent une prise en charge.** La plus ancienne attend depuis 2 jours. → *Voir la file*
  >
  > **17 demandes résolues** cette semaine, 2 de moins que la semaine dernière.
- **Comparaison écrite en mots :** « 2 de plus que… », « stable ». Une icône de flèche accompagne le texte ; on n'utilise jamais seulement une couleur (F43).
- **État de chaque indicateur** (normal, à surveiller, critique), avec une icône et un mot. Les seuils sont en constantes dans `lib/thresholds.ts` : par exemple, plus de 3 demandes en retard = « à surveiller ».
- **Liste « À surveiller »** (`summary.watch`), de 5 éléments au plus, chacun avec un lien.
- **Période :** « Aujourd'hui », « 7 jours » ou « 30 jours ». La période vit dans l'URL (`?periode=7j`).
- **Présentation :** pas d'animation, gros chiffres, une seule colonne sur mobile.
- **Impression :** `@media print` pour une impression propre, utile en réunion de service.
- **Données :** le même composant `SimpleDashboard` sert aux deux espaces. Chaque espace lui passe la liste de ses indicateurs.

## 6. Nettoyage

- `mocks/terraNova.ts`, `mocks/stats.ts` et `mocks/time.ts` sont supprimés, s'ils ne sont plus lus.
- Les multiplications de démonstration (`* 124`) et les écarts écrits en dur (`+8 % sur 7 j`) disparaissent.

## 7. Étapes

- [x] Backend : `GET /api/dashboard/trends` et `GET /api/dashboard/summary`
- [x] `src/api/terraNova.ts` et `NovaTerraPage` : flux réel, compte à rebours, nouvelle vague, filtres, erreurs
- [x] Encart Nova Terra du tableau de bord agent
- [x] Composant `SimpleDashboard` et bascule de vue sur les deux tableaux de bord
- [x] `AdminOverviewPage` sur données réelles
- [ ] Facultatif : `FeatureDelivery` et statut de livraison sur les cartes

**Réalisé (3 octobre 2026) :**
- **Retard :** une demande est en retard quand la ville doit encore agir au-delà d'un délai qui dépend de la priorité (`OVERDUE_HOURS` dans `backend/src/model/dashboard.model.ts` : 4 h urgente, 24 h haute, 72 h normale, 120 h basse).
- **Prise en charge :** premier événement `ASSIGNED` ou `STATUS_CHANGED` écrit par un agent ou un admin.
- **« Résolues » :** statut `RESOLVED` ou `CLOSED`, comptées à `resolved_at`.
- **Carte de chaleur :** en attendant `AuditLog` (BO-03), les actions du personnel sont lues dans `RequestEvent`.
- **Rendez-vous :** `stats.appointments.today` compte toute la journée (le compteur de menu `appointmentsToday` est branché). La période « Aujourd'hui » du résumé compare la journée entière à celle d'hier.
- **Panneaux qui dépendaient d'autres plans :** la file et le radar de l'agent lisent `stats` (prise en charge depuis la file, BO-01). Les fils « Activité de l'équipe » et « Activité du personnel » lisent `GET /api/dashboard/activity` (actions du personnel sur les demandes) ; le journal d'audit complet reste au BO-03.
- **Nettoyage :** `mocks/terraNova.ts` et `mocks/stats.ts` sont supprimés. `mocks/time.ts` reste, car d'autres mocks le lisent. Le graphique par service de `RequestsSupervisionPage` lit `trends(30).pickup_by_service`.

## 8. Critères d'acceptation

1. **D19.**
   - `agent@` ouvre « API Nova Terra » : la vague en cours (12 au moment de la rédaction) et les 67 demandes s'affichent, filtrables par groupe et par difficulté.
   - « Actualiser » interroge le serveur.
   - Le compte à rebours diminue chaque minute.
   - Si la clé est retirée du `.env` du backend, la page affiche un message clair au lieu de planter.
2. **D19, suivi de l'activité.** Les chiffres de la vue globale correspondent à la base. Par exemple, après une nouvelle demande, « Demandes à traiter » augmente de 1 au rafraîchissement suivant.
3. **F50.**
   - La « Vue simple » se lit sans graphique : au plus six phrases avec leur comparaison, et une liste « À surveiller » cliquable.
   - Changer la période met les chiffres à jour.
   - La vue reste lisible à 200 % de zoom et à l'impression.
   - Le choix de vue est conservé au rechargement.

## 9. Version minimale

À faire en premier :
- `NovaTerraPage` sur le vrai flux ;
- la vue simple avec `summary` (sans la liste « À surveiller » si le temps manque) ;
- les tuiles de la vue globale sur `stats`.

Peut attendre :
- `trends`, avec ses graphiques et sa carte de chaleur : les panneaux concernés affichent alors « Disponible prochainement » plutôt que des données simulées ;
- `FeatureDelivery`.

## 10. Points d'attention

- **Clé API :** `TERRA_NOVA_API_KEY` reste dans `backend/.env`. Elle n'apparaît jamais dans le front, dans un journal ou dans un fichier commité.
- **Coût des requêtes :** `trends` et `summary` font des agrégations. Les mettre en cache 30 s côté serveur si la base grossit.
