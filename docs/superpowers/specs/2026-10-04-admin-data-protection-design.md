# Protection des données administratives (D09 · F34 · F37) — design

**Date:** 2026-10-04  
**Product:** Express API (`backend/`) + back-office / espace citoyen (`frontend/`).  
**Refs:** D09 · F34 · F37 (PLAN-01, BO-00, BO-04, BO-05).  
**Scope:** Rendre perceptible et démontrable la réservation des données / outils admin aux profils autorisés, sans nouveau moteur de permissions ni friction sur le parcours normal.

## Problem

Certaines données et outils administratifs doivent rester strictement réservés aux agents et administrateurs autorisés. La protection doit se voir dans le fonctionnement réel (refus UI + refus API), sans compliquer une connexion ou un usage réussi.

## Mapping

| Exigence | Code | Preuve |
|---|---|---|
| Outils / données admin réservés | **D09** | `RequireStaff`, matrice `GET /api/permissions`, refus `401`/`403`, test live sur RolesPage |
| Pas d’accès indû à un espace / compte | **F34** | Agent : citoyens seulement ; pas d’e-mail / mot de passe / rôle |
| Protection perceptible, usage simple | **F37** | Compteur d’essais, blocage temporaire ; bannière « N tentatives échouées » après login réussi |

## Principles

1. **Le serveur est l’autorité.** Les gardes UI façonnent l’expérience ; elles ne remplacent jamais `authenticate` / `requireStaff` / `requireAdmin` ni le scoping des contrôleurs.
2. **La matrice documente, elle n’édite pas.** [`backend/src/lib/permissions.ts`](../../../backend/src/lib/permissions.ts) + `npm run check:permissions`.
3. **Perceptible ≠ pénible.** Un seul essai correct ouvre la session ; les messages d’échec et de refus sont explicites.
4. **YAGNI.** Pas de table de permissions runtime, pas de nouveaux rôles.

## Gaps closed in this lot

| Priorité | Gap | Fix |
|---|---|---|
| P1 | RolesPage « Vérifier un droit » purement prédictif | Bouton « Tester maintenant » : appelle les GET sans paramètre de la permission et affiche le statut HTTP réel pour le rôle connecté |
| P1 | F37 post-login citoyen peu visible | Persister `failed_attempts_since_last_login` à la connexion ; bannière dismissible sur `/ville/espace` |
| P2 | `GET /api/service-interruptions?scope=all` public | `scope=all` réservé au personnel (`403` sinon) ; public limité à current / upcoming / active |
| P2 | Écrans BO `simulated` pouvant paraître « ouverts » | Badge / libellé : les actions restent dans le navigateur, l’API réelle refuse hors rôle |

## Out of scope

- Permissions éditables en base / `can("key")` runtime  
- Masquage PII agent↔citoyen au-delà de F34  
- Chiffrement secret TOTP / `must_change_password` (BO-05)  
- Brancher BO-07 / BO-08 sur l’API (hors lot)

## Demo (~3 min)

1. Citoyen → `/agent` : écran réservé ; `GET /api/dashboard/stats` → 401/403.  
2. Agent → `/admin` : redirect `/agent` ; `GET /api/settings` → 403.  
3. Admin → Rôles : badge Sensible + « Tester maintenant » → 200 / 403 réels.  
4. Mauvais mot de passe : « Il reste N essais » ; après login réussi avec échecs antérieurs : bannière sur Mon espace.
