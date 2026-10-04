# PLAN-05 : rendez-vous et rappels

> **Réfs :** F39 · F40. **XP :** 900.
> **Dépend de :** PLAN-00, PLAN-01, PLAN-02 (fiche service et disponibilité), PLAN-04 (centre de notifications).
> **Effort :** environ 3 h 30.

## 1. Pourquoi ces demandes vont ensemble

Prendre rendez-vous avec un agent (F39) et recevoir un rappel avant ce rendez-vous (F40) portent sur le même objet, `Appointment`.

Les deux demandes ont la même exigence : aucune ambiguïté sur le créneau choisi, et toutes les informations utiles pour préparer le rendez-vous.

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| F39 | Service Administration | Prendre rendez-vous avec un agent, sans ambiguïté, avec de quoi se préparer | Prise de rendez-vous en 4 étapes, libellés de créneau complets, documents à apporter |
| F40 | Citoyenne | Recevoir un rappel avant le rendez-vous | Rappel choisi lors de la réservation, modifiable, et reçu dans les notifications |

## 2. Existant

### Backend (prêt)

**Créneaux**

| Besoin | Endpoint |
|---|---|
| Lister les créneaux (public, avec le nombre de places restantes) | `GET /api/appointments/slots?service_id=&agent_id=&from=&to=` |
| Créer un créneau | `POST /api/appointments/slots` |
| Créer une série de créneaux | `POST /api/appointments/slots/bulk` |
| Modifier ou supprimer un créneau | `PATCH /api/appointments/slots/:id`, `DELETE /api/appointments/slots/:id` |

Une série se définit par :
- une plage de dates (`from_date`, `to_date`) ;
- une plage horaire (`start_time`, `end_time`) et une durée (`duration_minutes`) ;
- les jours de la semaine (`weekdays`) ;
- la capacité, le lieu et les consignes de préparation.

**Réservation**

`POST /api/appointments { slot_id, reason, procedure_id?, reminder_offset_minutes }` :
- le créneau est verrouillé pendant l'écriture (`SELECT … FOR UPDATE`), ce qui empêche de dépasser sa capacité ;
- la réponse contient :
  - `when` : dates ISO, durée, fuseau horaire, libellé lisible ;
  - `where` et `with` ;
  - `preparation` : consignes, documents, contact ;
  - `calendar_url`.

**Suivi**

| Besoin | Endpoint | Accès |
|---|---|---|
| Lister les rendez-vous | `GET /api/appointments?scope=upcoming\|past\|all&status=&service_id=&mine=` | `mine` est réservé au personnel |
| Télécharger le fichier agenda | `GET /:id/ics` | Propriétaire |
| Annuler | `POST /:id/cancel` | Propriétaire |
| Changer le rappel | `PATCH /:id/reminder` | Propriétaire |
| Changer le statut ou les notes de l'agent | `PATCH /:id { status, agent_notes }` | Personnel |

**Rappels**
- Un planificateur dans le processus de l'API s'exécute chaque minute ; un cron cPanel prend le relais en production.
- Un rappel n'est jamais envoyé deux fois.
- `POST /api/appointments/reminders/run` (admin) les déclenche à la demande.
- Le délai de rappel va de 15 minutes au maximum autorisé.

### Front citoyen

Rien n'existe encore.

### Back-office

`AppointmentsPage` (agenda de l'agent, rendez-vous honoré ou absence, notes) et `SlotsPage` (générateur de séries) fonctionnent sur des données simulées (`appointmentStore`).

## 3. Backend : ce qui manque

| Manque | Correctif |
|---|---|
| Fiche citoyen (F34) et agenda sur une période | Ajouter `citizen_id` (personnel uniquement), `from` et `to` à `listQuerySchema` |
| Rappel par défaut | **Fait au PLAN-00** : sans `reminder_offset_minutes`, la réservation prend `reminder_default_minutes` (paramètre réglable dans la page Paramètres). |
| Option « Pas de rappel » : `zReminder` impose au moins 15 min | Accepter `reminder_offset_minutes: null`, qui signifie « aucun rappel », et faire ignorer ces rendez-vous par le planificateur |
| Le fichier `.ics` exige le JWT, alors qu'un simple lien `<a href>` n'envoie pas l'en-tête d'authentification | Côté front, télécharger avec `http.get(…, { responseType: 'blob' })` puis `URL.createObjectURL`. Autre option, côté backend : un jeton signé de courte durée dans `calendar_url` |

## 4. Front citoyen

### 4.1 Prendre rendez-vous (F39) : `/ville/rendez-vous/nouveau?service=<slug>`

On y accède depuis la fiche service (PLAN-02), le raccourci de l'accueil et « Mon espace ». Le parcours a 4 étapes, avec un **récapitulatif toujours visible** de ce qui a déjà été choisi.

1. **Service.**
   - Prérempli quand on vient d'une fiche service.
   - Seuls les services qui ont des créneaux sont proposés.
   - Leur disponibilité (F38) est affichée avec `AvailabilityNotice`.
2. **Jour.**
   - Les 14 prochains jours.
   - Un jour sans créneau est désactivé et sa raison est écrite : « Complet » ou « Fermé le dimanche ».
3. **Heure.**
   - La liste des créneaux libres, avec le nombre de places restantes.
   - Le libellé est complet et sans ambiguïté : **« Mardi 7 octobre 2026, de 09:30 à 10:00 (heure de Terra Nova) »**, suivi du lieu et de l'agent.
4. **Motif et rappel.**
   - Le motif, et une démarche liée si besoin.
   - Le rappel : « La veille » (24 h, choix par défaut), « 2 h avant », « 1 h avant » ou « Pas de rappel ».

L'envoi appelle `POST /api/appointments`, puis affiche la **confirmation**, qui contient :
- la référence `RDV-…` ;
- quand : le libellé fourni par le backend ;
- où et avec qui ;
- **ce qu'il faut préparer** : consignes, documents à apporter, contact ;
- le rappel choisi ;
- un bouton « Ajouter à mon agenda » (fichier `.ics`) ;
- un lien « Voir mes rendez-vous ».

Cas d'erreur :
- **`409` créneau déjà pris entre-temps :** afficher « Ce créneau vient d'être réservé, choisissez-en un autre ». La liste se rafraîchit et le jour choisi reste sélectionné.
- **`409 SERVICE_UNAVAILABLE` :** afficher `AvailabilityNotice` (PLAN-02).

### 4.2 Mes rendez-vous (F39, F40) : `/ville/espace/rendez-vous`

- Deux onglets : « À venir » et « Passés ».
- Chaque carte de rendez-vous affiche :
  - le libellé complet et un compte à rebours (« dans 2 jours ») ;
  - le lieu ;
  - ce qu'il faut préparer ;
  - le statut : réservé, honoré, absent ou annulé.
- Actions :
  - **Annuler :** confirmation et motif facultatif, puis `POST /:id/cancel` ;
  - **Changer le rappel :** `PATCH /:id/reminder` ;
  - **Télécharger le fichier `.ics`**.
- Sur l'accueil et dans « Mon espace », une carte « Prochain rendez-vous » s'affiche à partir de `home.me.next_appointment`.

### 4.3 Rappels (F40)

- À l'heure choisie, le serveur envoie une notification dans l'application. Elle apparaît dans la cloche (PLAN-04) et mène au rendez-vous.
- En option : si l'onglet est ouvert et que l'habitant l'a autorisé, la même notification s'affiche aussi en notification système (API `Notification` du navigateur).
- Le récapitulatif indique toujours quand le rappel partira : « Rappel prévu lundi 6 octobre à 09:30 ».

## 5. Back-office

### `agent/pages/AppointmentsPage.tsx` (F39)

- **Lecture :** `GET /api/appointments?scope=all&mine=true&from=&to=`, en vue jour ou semaine.
- **Actions :**
  - `setAppointmentStatus` → `PATCH /:id { status: 'COMPLETED' | 'NO_SHOW' }` ;
  - `saveAgentNotes` → `PATCH /:id { agent_notes }` ;
  - lien vers la fiche du citoyen (PLAN-01).

### `admin/pages/SlotsPage.tsx` (F39)

- **Lecture :** `GET /api/appointments/slots?from=&to=&service_id=`.
- **Actions :**
  - `addSlots` → `POST /slots/bulk` ;
  - modifier la capacité, le lieu ou l'activation d'un créneau → `PATCH /slots/:id` ;
  - supprimer un créneau → `DELETE /slots/:id`. S'il est déjà réservé, afficher le refus du serveur ;
  - « Envoyer les rappels maintenant » → `POST /reminders/run`, pour la démo.

### Badge `appointmentsToday` du menu

Valeur : `meta.total` de `GET /api/appointments?mine=true&from=<aujourd'hui>&to=<aujourd'hui>&limit=1`.

### Nettoyage

`stores/appointmentStore.ts` et `mocks/appointments.ts` sont supprimés. Leur contenu a d'abord servi au seed.

## 6. Étapes

- [x] Backend : `citizen_id`, `from` et `to` dans la liste ; rappel `null` (« Pas de rappel ») ; en plus : jour et heures des créneaux dans le fuseau de la ville (`day`, `start_time`…), et `blocked` pour un créneau pendant une interruption (F38)
- [x] `src/api/appointments.ts`, avec le téléchargement `.ics` en blob
- [x] Parcours `/ville/rendez-vous/nouveau` (4 étapes, récapitulatif, confirmation, gestion des conflits)
- [x] `/ville/rendez-vous` (pas encore d'« espace ») : annulation, changement de rappel, fichier `.ics` ; rappel affiché sur tous les écrans par `ReminderWatcher`, notification du navigateur sur demande
- [x] Liens depuis la fiche service, l'accueil (« Prochain rendez-vous ») et la barre des pages console ; « Mon espace » n'existe pas encore
- [ ] Back-office : `AppointmentsPage` (fait), `SlotsPage`, badge (déjà réel via `dashboard/stats`)
- [ ] Rendez-vous du citoyen dans `CitizensPage` (PLAN-01)

## 7. Critères d'acceptation

1. **F39, côté habitant :**
   - Depuis la fiche « État civil », réserver un créneau en 4 étapes.
   - Le créneau s'affiche partout avec la date complète, l'heure de début et de fin, et le fuseau horaire.
   - La confirmation liste les documents à apporter.
   - Deux habitants ne peuvent pas prendre la dernière place d'un même créneau : le second reçoit un message clair.
2. **F39, côté agent :** l'agent voit le rendez-vous dans son agenda, puis le marque « honoré » en ajoutant une note. L'habitant voit le nouveau statut.
3. **F40 :**
   - Avec un rappel « 1 h avant » sur un créneau proche, la notification arrive dans la cloche et ouvre le rendez-vous. En démo, « Envoyer les rappels maintenant » déclenche l'envoi tout de suite.
   - Changer le rappel fonctionne.
   - Annuler le rendez-vous fonctionne, et aucun rappel n'est alors envoyé.

## 8. Version minimale

À faire en premier :
- la réservation en 4 étapes et la confirmation ;
- « Mes rendez-vous », avec l'annulation ;
- l'agenda de l'agent ;
- le rappel par défaut (la veille), reçu dans les notifications.

Peut attendre :
- le générateur de séries de créneaux (les créneaux du seed suffisent) ;
- le fichier `.ics` ;
- l'option « Pas de rappel » ;
- les notifications système du navigateur.

## 9. Points d'attention

- **Fuseau horaire :** les libellés et les horaires dépendent du `TZ` du serveur. Le front affiche le libellé renvoyé par le backend, ou formate les dates avec le même fuseau, jamais celui du navigateur.
- **Pas d'e-mail :** le rappel est envoyé uniquement dans l'application, faute de service d'envoi d'e-mails. Le dire au jury.
