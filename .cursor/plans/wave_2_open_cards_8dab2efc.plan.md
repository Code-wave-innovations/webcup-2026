---
name: Wave 2 open cards
overview: Of the five Wave 2 cards, only D16 (confirmation after sending a request) and D15 (knowing where you are and going back) are still open. D17 is already live in the staff space, D14 stays excluded as multilingual, and the first-login tutorial (D12) is deferred.
todos:
  - id: d16-confirmation
    content: Wire the citizen report form to POST /api/requests and replace the fake TN-0416 toast with RequestConfirmation (reference, copy, next step, no double submit).
    status: pending
  - id: d15-orientation
    content: Add console Retour, active rubrique, and /ville/services plus /ville/services/:slug with a real breadcrumb trail back to the city.
    status: pending
isProject: false
---

# Wave 2 cards: what is left

## Already done — do not rebuild

**D17** (how many requests still wait to be picked up) is live end to end.

- The API returns `requests.awaiting_pickup` from `GET /api/dashboard/stats`.
- Agents see it on the dashboard ([frontend/src/backoffice/agent/pages/AgentDashboardPage.tsx](frontend/src/backoffice/agent/pages/AgentDashboardPage.tsx)), in the requests header and the “En attente de prise en charge” chip ([frontend/src/backoffice/agent/pages/RequestsPage.tsx](frontend/src/backoffice/agent/pages/RequestsPage.tsx)).
- Admins see it on the overview and on supervision ([frontend/src/backoffice/admin/pages/RequestsSupervisionPage.tsx](frontend/src/backoffice/admin/pages/RequestsSupervisionPage.tsx)).
- The sidebar badge on Demandes is on every staff screen ([frontend/src/backoffice/layout/useBadges.ts](frontend/src/backoffice/layout/useBadges.ts), [frontend/src/backoffice/nav.ts](frontend/src/backoffice/nav.ts)). Taking a request invalidates the dashboard query, so the number drops.

**D14** (choose another interface language) is stamped “Exclu : multilingue” on the card and in [project-plan/README.md](project-plan/README.md). Leave it out. The translation API and the simulated Translations page stay as they are.

## Later — not in this pass

**D12** (first login: complete the profile, find a service, start a procedure) is the tutorial. The server already has `User.onboarding_completed` and `POST /api/me/onboarding/complete`. The citizen screen does not. When you pick it up, follow [project-plan/09-accompagnement-D12-D13-F35.md](project-plan/09-accompagnement-D12-D13-F35.md) section 4.1 only (`/ville/bienvenue`, three skippable steps, “Bien démarrer” card). D13 and F35 stay out of that later pass unless you ask for them.

## Do now

### D16 — a clear confirmation the moment a request is sent

The server already answers `201` with `reference` and `message` ([backend/src/controller/citizenRequest.controller.ts](backend/src/controller/citizenRequest.controller.ts)). The citizen form does not use it. [frontend/src/features/reports/reportStore.ts](frontend/src/features/reports/reportStore.ts) invents the code `TN-0416` and only announces a toast. There is no `useCreateRequest`.

- Add `useCreateRequest` in [frontend/src/api/requests.ts](frontend/src/api/requests.ts): `POST /api/requests`, then invalidate the request lists and dashboard keys.
- Add `RequestConfirmation` (citizen UI, next to the report panel). It replaces the form. It shows “Demande envoyée”, the reference with a copy button, the server message, and the next step (“un agent va la prendre en charge”). Focus moves to the title and the text is in `role="status"`. Actions: “Suivre ma demande” (the existing tracker, fed by the real reference and status) and “Envoyer une autre demande”.
- Point `ReportForm` at that mutation (`type: 'INCIDENT'`, subject from the text, district from the sector when it matches a seeded district). Disable the button while the request is in flight so a double click creates one request. Show `429` and `409 SERVICE_UNAVAILABLE` as a clear message, not a second request.
- Drop the fixed `TN-0416` and the “Faire avancer la démonstration” path for a request that came from the API. The beam still lights from the real status.

The citizen notification bell is PLAN-04. This pass only relies on the confirmation text; the server already stores the notification.

### D15 — where you are, and a way back

The flyover already marks the current section (`RouteRail` and the top links in [frontend/src/pages/CityPage/CityChrome.tsx](frontend/src/pages/CityPage/CityChrome.tsx)). Leave that as it is.

Off the flyover, [frontend/src/ui/Breadcrumbs.tsx](frontend/src/ui/Breadcrumbs.tsx) and `ConsolePage` already render “Accueil › … › page” with `aria-current="page"`. Nothing real uses the intermediate levels: `/ville/*` is only the test page, 404, and access denied. The console bar has a single link, “Accueil de la ville”, and no back control ([frontend/src/pages/Console/ConsoleTopBar.tsx](frontend/src/pages/Console/ConsoleTopBar.tsx)).

- Add a “Retour” control on the console that follows browser history and falls back to `/ville`.
- Add two routes so the trail has real levels: `/ville/services` and `/ville/services/:slug`, read from `GET /api/services` and `GET /api/services/:idOrSlug` through a small `src/api/services.ts`. The list is the catalogue grouped by category. The detail shows name, description, contact, hours, and address. Each page passes `crumbs` so the trail reads “Accueil › Services › {service}”.
- In the console bar, mark the current rubrique with `aria-current` (Accueil, Services). Each page already sets the document title through `ConsolePage`.
- From the flyover Services section, link into `/ville/services` so leaving one service for another is a real path you can walk back.

Search, featured services, availability, and the maintenance screen stay in PLAN-02. They are not required to prove D15.
