# BO-03 : traçabilité, journal d'audit et historiques

> **Rôle :** Agent (activité de l'équipe) et Admin (journal d'audit complet).
> **Réfs :** F47 · F48. **XP :** 1 600.
> **Dépend de :** BO-00 et BO-04, qui fournissent les comptes et les acteurs.
> **Étape 1 :** à faire juste après le BO-04, pour que les plans suivants soient audités dès leur branchement.
> **Même travail que :** `project-plan/10-…md`, § 3.1 et § 4. Le faire une seule fois.
> **Effort :** ≈ 4 h.

## 1. Pourquoi ces réfs vont ensemble

Les deux demandes portent sur la même donnée, **qui a fait quoi, quand et sur quoi**, consultée dans l'espace de travail.

| Réf | Demandeur | Besoin | Ce que le back-office doit montrer |
|---|---|---|---|
| F47 | Autorité de Contrôle | Justifier les actions réalisées ; certaines opérations doivent rester consultables et traçables dans le temps ; facile à retrouver | Un journal **immuable**, filtrable, exportable, conservé sans purge, et lisible en une ligne par action |
| F48 | Service Qualité | Savoir qui a modifié quoi dans l'administration | Le détail « avant → après » de chaque modification, et l'historique propre à chaque objet, dans son tiroir |

## 2. Écrans et état actuel

| Écran | Route | Rôle | Aujourd'hui |
|---|---|---|---|
| `ActivityPage` | `/agent/activite` | Agent | `auditStore`, `userStore` |
| `AuditPage` | `/admin/audit` | Admin | `auditStore`, export CSV simulé |
| `shared/AuditFeed` | Tableaux de bord | Les deux | `startLiveAudit()` invente une action toutes les 9 s |
| `recordAudit()` | Tous les stores | — | Appelé par le navigateur à chaque action simulée |

**Backend :**
- `RequestEvent` trace les demandes, et `LoginAttempt` les connexions.
- **Il n'existe aucun journal général.**
- Le type `AuditLog` de `mocks/types.ts` décrit le contrat visé.

## 3. Backend (étape 1)

### 3.1 Modèle

```prisma
// F47 / F48: who did what, when, on which record (before -> after)
model AuditLog {
  id           Int      @id @default(autoincrement())
  created_at   DateTime @default(now())
  actor_id     Int?               // null = système (planificateur, cron)
  actor_role   Role?
  actor_name   String?            // figé au moment de l'action (survit à la suppression du compte)
  action       String   @db.VarChar(64)  // request.status_changed, service.updated, user.unlocked…
  entity       String   @db.VarChar(64)  // CitizenRequest, CityService, User…
  entity_id    Int?
  entity_label String?            // NT-261003-4F9A2C, « État civil »…
  changes      Json?              // [{ field, from, to }]
  metadata     Json?              // motif, nombre de destinataires…
  ip           String?  @db.VarChar(64)

  @@index([entity, entity_id])
  @@index([actor_id, created_at])
  @@index([action])
  @@index([created_at])
}
```

### 3.2 Écriture : `src/lib/audit.ts`

`audit(req, { action, entity, entityId, label, before, after, fields, metadata })` :
- calcule les différences sur les seuls champs listés dans `fields` ;
- n'enregistre jamais de secret (`password_hash`, token, secret de double vérification) ;
- relève l'IP avec `clientIp()`, qui peut renvoyer `undefined` sur cPanel ;
- ne fait jamais échouer l'action métier : une erreur d'écriture est seulement consignée.

### 3.3 Actions auditées

Toutes les mutations du personnel, plan par plan :

| Plan | Actions |
|---|---|
| BO-01 | `request.status_changed`, `request.assigned`, `request.priority_changed`, `request.internal_note`, `request.bulk_updated` |
| BO-04 | `user.created`, `user.updated`, `user.role_changed`, `user.deactivated`, `user.reactivated`, `user.deleted`, `user.login_unlocked` ; `user.self_deleted` (F33, sans donnée personnelle) |
| BO-05 | `security.new_device`, `security.sessions_revoked`, `security.2fa_enabled`, `security.2fa_reset`, `security.passkey_added`, `security.passkey_revoked`, `auth.staff_login` |
| BO-06 | `service.created`, `service.updated`, `service.featured`, `service.disabled`, `service.enabled`, `procedure.*`, `interruption.*`, `settings.updated` |
| BO-07 | `announcement.created`, `announcement.updated`, `announcement.published`, `announcement.archived`, `announcement.deleted` ; `alert.created`, `alert.updated`, `alert.closed` ; `broadcast.sent` |
| BO-08 | `slot.created` (une entrée pour une série, avec le nombre de créneaux), `slot.updated`, `slot.deleted`, `appointment.status`, `appointment.notes`, `reminders.run` |
| BO-09 | `transit.line_status`, `transit.stops`, `transit.timetable`, `place.*`, `glossary.*` |
| BO-10 | `project.*`, `consultation.*`, `contribution.moderated`, `contribution.answered` |

Le plan qui branche un écran ajoute ses appels à `audit()` dans les contrôleurs concernés. Une ligne de ce tableau sert de liste de contrôle.

### 3.4 Règles

- **Immuable :** aucune route de modification ni de suppression, et aucune purge automatique. C'est ce qui rend les opérations « traçables dans le temps » (F47).
- **Seed :** quelques entrées d'historique, pour que les écrans ne soient pas vides au premier lancement.

### 3.5 Endpoints

| Endpoint | Accès | Rôle |
|---|---|---|
| `GET /api/audit-logs?actor_id=&entity=&entity_id=&action=&from=&to=&q=&page=` | personnel | Agents : tout, sauf les entrées `security.*` et les IP. Admins : tout. |
| `GET /api/audit-logs/export.csv` | admin | Mêmes filtres. CSV en UTF-8 avec BOM, lisible dans Excel. L'export est lui-même audité (`audit.exported`). |
| `GET /api/audit-logs/stats?days=14` | admin | Actions par jour et par acteur, pour la vue globale (BO-02) |

## 4. Branchement écran par écran (étape 2)

Fichier front : `src/api/audit.ts` (`useAuditLogs`, `useAuditStats`, `downloadAuditCsv`).

### 4.1 Lecture d'une entrée

Une entrée se lit en une ligne :

> **Ada R.** · il y a 3 min · a modifié le service **« Prévention santé »** · priorité : 2 → 5

- Les noms de champs et les valeurs internes sont traduits en français par `lib/labels.ts` (`auditField`, `auditValue`). Par exemple, `IN_REVIEW` devient « En examen ».
- Un clic ouvre le détail : tableau avant → après, IP (admin), métadonnées comme le motif ou le nombre de destinataires, et lien vers l'objet.

### 4.2 Écrans

| Écran | Lecture | Actions |
|---|---|---|
| `ActivityPage` (agent) | Onglets « Mes actions » (`actor_id=moi`) et « Équipe ». Filtres : objet, action, période. | Aucune |
| `AuditPage` (admin) | `GET /api/audit-logs`, filtres dans l'URL : acteur, objet, action, période, texte | « Exporter » : téléchargement de `export.csv` en blob, avec les filtres en cours |
| `AuditFeed` (tableaux de bord) | `GET /api/audit-logs?limit=8`, toutes les 15 s | Aucune. Les nouvelles entrées s'éclairent brièvement. |
| **Historique d'un objet** (F48) : onglet « Historique » des tiroirs Services, Utilisateurs, Annonces, Alertes, Lieux, Lexique, et de `RequestDetailPage` | `GET /api/audit-logs?entity=&entity_id=` | Aucune |

Le composant `EntityHistory` (`shared/EntityHistory.tsx`) est commun à tous ces tiroirs. Il prend `entity` et `entityId`.

## 5. Nettoyage

Sont supprimés :
- `stores/auditStore.ts`, `startLiveAudit` et `recordAudit` ;
- les appels à `recordAudit` dans les stores restants ;
- `mocks/audit.ts` et ses `LIVE_TEMPLATES`.

La mention « Données simulées » de l'ancien flux en direct disparaît.

## 6. Étapes

1. [ ] **Étape 1, backend :**
   - [ ] `AuditLog`, migration et `lib/audit.ts` ;
   - [ ] appels dans les contrôleurs existants (demandes, comptes, catalogue, interruptions, annonces, alertes, rendez-vous, transports, paramètres) ;
   - [ ] `GET /api/audit-logs` et seed.
2. [ ] `src/api/audit.ts`, `ActivityPage`, `AuditPage` et l'export
3. [ ] `EntityHistory`, posé dans les tiroirs déjà branchés, puis dans ceux des plans suivants
4. [ ] `AuditFeed` sur données réelles, puis suppression de l'audit côté navigateur
5. [ ] `GET /api/audit-logs/stats`, pour la vue globale (BO-02)

## 7. Critères d'acceptation

1. **F48.**
   - `admin@` change la priorité d'un service, de 2 à 5.
   - Dans `/admin/audit`, l'entrée apparaît en tête : « Ada R. · il y a quelques secondes · Service « … » · priorité : 2 → 5 ».
   - Le tiroir du service affiche la même entrée dans son onglet « Historique ».
2. **F48, côté agent.** `agent@` passe une demande à « En cours ». « Activité › Mes actions » affiche l'action. « Équipe » affiche aussi celles d'Ada, mais sans IP ni entrée de sécurité.
3. **F47.**
   - Le journal se filtre par période et par acteur.
   - L'export CSV s'ouvre dans un tableur avec les accents corrects.
   - Il n'existe aucun moyen de modifier ou de supprimer une entrée : aucune route, aucun bouton.
4. Aucune action simulée n'apparaît plus dans le flux en direct.

## 8. Version minimale

À faire en premier :
- l'étape 1 sur les demandes et les comptes ;
- `AuditPage` ;
- `ActivityPage`.

Peut attendre :
- l'export ;
- les historiques dans les tiroirs ;
- les statistiques.

## 9. Points d'attention

- **Données personnelles :** les coordonnées d'un habitant (téléphone, adresse) ne sont pas copiées dans le journal. `changes` contient `{ field: 'phone', masked: true }` et l'écran affiche « téléphone modifié ». Les autres champs gardent leur avant → après.
- **Volume :** `AuditLog` grossit sans limite, par choix (F47). Les index ci-dessus suffisent pour le hackathon.
