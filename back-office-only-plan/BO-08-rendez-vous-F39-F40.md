# BO-08 : rendez-vous — agenda des agents et créneaux

> **Rôle :** Agent (agenda, présence, notes) et Admin (créneaux, rappels).
> **Réfs :** F39 · F40. **XP :** 900.
> **Dépend de :** BO-00. Le BO-03 est recommandé, pour l'audit. Le BO-06 est utile, pour les services indisponibles.
> **Pendant citoyen :** PLAN-05 de `project-plan/`. Ce plan reprend sa section 5 et les manques backend dont le back-office a besoin.
> **Effort :** ≈ 2,5 h.

## 1. Pourquoi ces réfs vont ensemble

Les deux demandes portent sur **le même objet, `Appointment`, et ses créneaux**. L'agent reçoit les habitants, l'admin ouvre les créneaux et déclenche les rappels.

| Réf | Demandeur | Besoin | Ce que le back-office doit permettre |
|---|---|---|---|
| F39 | Service Administration | Prendre rendez-vous avec un agent, sans ambiguïté, avec de quoi se préparer | Ouvrir des créneaux clairs (lieu, capacité, consignes de préparation). Voir son agenda, marquer « honoré » ou « absent », noter. |
| F40 | Citoyenne | Recevoir un rappel avant le rendez-vous | Voir le rappel choisi par l'habitant et s'il est parti. Déclencher les rappels à la demande, pour la démo. |

## 2. Écrans et état actuel

| Écran | Route | Rôle | Aujourd'hui |
|---|---|---|---|
| `AppointmentsPage` | `/agent/rendez-vous` | Agent | `appointmentStore` : `setAppointmentStatus`, `saveAgentNotes` |
| `SlotsPage` | `/admin/rendez-vous` | Admin | `addSlots`, qui génère les créneaux dans le navigateur |
| `shared/AppointmentAgenda` | — | — | Typé par `mocks/types` |
| Badge `appointmentsToday` | Menu | Agent | Calculé sur le store |

**Backend prêt :**
- **Créneaux :**
  - `GET /api/appointments/slots?service_id=&agent_id=&from=&to=`, avec les places restantes ;
  - `POST /slots`, `POST /slots/bulk` (plage de dates, plage horaire, durée, jours de la semaine, capacité, lieu, consignes), `PATCH /slots/:id` et `DELETE /slots/:id`, pour le personnel.
- **Rendez-vous :**
  - `GET /api/appointments?scope=upcoming|past|all&status=&service_id=&mine=` (`mine` est réservé au personnel) ;
  - `PATCH /api/appointments/:id { status, agent_notes }`, pour le personnel.
- **Rappels :**
  - `POST /api/appointments/reminders/run`, réservé aux admins ;
  - un planificateur s'exécute chaque minute, avec un cron cPanel en production ;
  - un rappel n'est jamais envoyé deux fois.

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| Agenda sur une période, et rendez-vous d'un citoyen (fiche, BO-04) | Ajouter `from`, `to` et `citizen_id` (réservé au personnel) au schéma de liste de `GET /api/appointments` |
| Afficher le rappel côté agent | La liste renvoie `reminder_offset_minutes` et `reminder_sent_at`. Vérifier qu'ils sont dans la sélection, sinon les y ajouter. |
| Option « Pas de rappel » (PLAN-05) | `reminder_offset_minutes: null` est accepté, et le planificateur ignore ces rendez-vous. Le back-office affiche alors « Aucun rappel ». |
| Résultat de `reminders/run` | Renvoyer `{ sent }`, pour le toast « 3 rappels envoyés ». |

## 4. Branchement écran par écran

Fichier front : `src/api/appointments.ts` (`useAppointments`, `useUpdateAppointment`, `useSlots`, `useCreateSlotSeries`, `useUpdateSlot`, `useDeleteSlot`, `useRunReminders`).

### 4.1 `AppointmentsPage` (agent, F39, F40)

**Lecture :** `GET /api/appointments?scope=all&mine=true&from=&to=`, en vue jour ou semaine. La période est gardée dans l'URL.

**Carte d'un rendez-vous :**
- libellé complet du créneau, tel que le renvoie le backend : « Mardi 7 octobre 2026, de 09:30 à 10:00 » ;
- habitant, avec un lien vers sa fiche (BO-04) ;
- motif et démarche liée ;
- documents à apporter ;
- rappel : « Rappel la veille · envoyé le 6 oct. à 09:30 » ou « Aucun rappel ».

**Actions**

| Fonction simulée | Appel |
|---|---|
| `setAppointmentStatus` | `PATCH /:id { status: 'COMPLETED' \| 'NO_SHOW' }`. Le bouton « Absent » n'est actif qu'après l'heure de début. |
| `saveAgentNotes` | `PATCH /:id { agent_notes }` |

**Badge `appointmentsToday` :** `meta.total` de `GET /api/appointments?mine=true&from=<aujourd'hui>&to=<aujourd'hui>&status=BOOKED&limit=1`.

**Tableau de bord agent :** la tuile « Rendez-vous aujourd'hui » utilise la même requête.

### 4.2 `SlotsPage` (admin, F39, F40)

**Lecture :**
- `GET /api/appointments/slots?from=&to=&service_id=&agent_id=`, sur un calendrier ;
- les rendez-vous de la période, pour afficher le remplissage de chaque créneau.

**Actions**

| Fonction simulée ou nouveauté | Appel |
|---|---|
| `addSlots` (générateur) | `POST /slots/bulk { service_id, agent_id, from_date, to_date, start_time, end_time, duration_minutes, weekdays, capacity, location, preparation_notes }`. Le calcul n'est plus fait dans le navigateur. Un aperçu indique le nombre de créneaux avant l'envoi. |
| Modifier la capacité, le lieu, les consignes ou l'activation | `PATCH /slots/:id` |
| Supprimer | `DELETE /slots/:id`. Si des rendez-vous existent, afficher le refus du serveur et proposer de désactiver le créneau. |
| « Envoyer les rappels maintenant » (démo F40) | `POST /api/appointments/reminders/run`, puis le toast « N rappels envoyés » |

**Clarté du créneau (F39) :** les consignes de préparation, saisies ici, sont ce que l'habitant lit à la confirmation. Un aperçu « Ce que verra l'habitant » les affiche sous le libellé complet du créneau.

**Service indisponible (BO-06) :** si une interruption couvre une partie de la période, les créneaux concernés sont barrés, avec le motif.

## 5. Nettoyage

Sont supprimés :
- `stores/appointmentStore.ts` ;
- `mocks/appointments.ts`.

## 6. Étapes

- [ ] Backend : `from`, `to` et `citizen_id` sur la liste ; champs de rappel ; `null` pour « Pas de rappel » ; `{ sent }`
- [ ] `src/api/appointments.ts` et ses types
- [ ] `AppointmentsPage` : agenda, statuts, notes, rappel affiché
- [ ] `SlotsPage` : calendrier, générateur côté serveur, modification, suppression, rappels à la demande
- [ ] Badge `appointmentsToday` et tuile du tableau de bord
- [ ] Rendez-vous dans la fiche citoyen (BO-04)
- [ ] Nettoyage

## 7. Critères d'acceptation

1. **F39, côté admin.**
   - `admin@` génère une série : « Centre de santé », du lundi au vendredi pendant 2 semaines, 09:00-12:00 par tranches de 30 min, 2 places, avec des consignes.
   - Le calendrier affiche le bon nombre de créneaux.
   - Côté habitant, ils sont réservables et affichent les consignes.
2. **F39, côté agent.**
   - Un rendez-vous réservé par `citoyen@` apparaît dans l'agenda de `agent@`, avec le libellé complet et les documents à apporter.
   - L'agent le marque « honoré » et ajoute une note. L'habitant voit le nouveau statut.
3. **F40.**
   - Un rendez-vous proche, avec le rappel « 1 h avant », affiche « Rappel prévu à … ».
   - « Envoyer les rappels maintenant » affiche « 1 rappel envoyé ». La carte indique alors « envoyé à … ».
   - Un second clic n'envoie rien.
4. Supprimer un créneau réservé est refusé avec un message clair.

## 8. Version minimale

À faire en premier :
- l'agenda de l'agent, avec les statuts et les notes ;
- le badge ;
- « Envoyer les rappels maintenant ».

Peut attendre : le générateur de séries, car les créneaux du seed suffisent.

## 9. Points d'attention

- **Fuseau horaire :** afficher les libellés renvoyés par le backend, ou formater avec le fuseau du serveur (`TZ`), jamais celui du navigateur.
- **Pas d'e-mail :** le rappel est envoyé seulement dans l'application. Le dire au jury.
