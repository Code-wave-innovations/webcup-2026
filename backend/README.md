## Terra Nova API

### Setup

```bash
docker compose up -d
cp .env.examle .env      # set DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run seed             # demo data + accounts (password NovaTerra2026! unless SEED_PASSWORD is set)
npm run dev
```

Demo accounts: `admin@novaterra.local`, `agent@novaterra.local`, `citoyen@novaterra.local`, `senior@novaterra.local` (vulnerable citizen).

### Conventions

- Auth: `Authorization: Bearer <token>` (token returned by `/api/auth/register` and `/api/auth/login`).
- Roles: `CITIZEN`, `AGENT`, `ADMIN`. "Staff" = `AGENT` + `ADMIN`.
- Paginated lists return `{ data, meta: { page, limit, total, pages } }` and accept `?page=&limit=`.
- Errors return `{ error: { code, message, details? } }` (400 validation, 401, 403, 404, 409 duplicate).
- Translated content: add `?lang=en` (otherwise the user's locale, then `Accept-Language`, then `fr`).
- File fields are sent as `multipart/form-data` (jpg, png, webp, gif, pdf, 10 MB max) and served from `/public/<file>`.

### Endpoints

| Method & path | Access | Feature |
|---|---|---|
| `POST /api/auth/register` · `POST /api/auth/login` | public | D01, D03 |
| `GET/PATCH /api/me` · `PATCH /api/me/password` · `POST /api/me/onboarding/complete` | logged in | D03, D12, D14, F23/F24 (`preferences`) |
| `GET/POST /api/users` · `GET/PATCH/DELETE /api/users/:id` | admin | D08, D09 |
| `GET /api/home` | public | D07 (alerts, featured services, categories, news) |
| `GET /api/search?q=` | public (+ own requests when logged in) | F32 |
| `GET /api/services?category=&featured=&q=&sort=` · `GET /api/services/:idOrSlug` | public | D05, F28 |
| `POST /api/services` · `PATCH/DELETE /api/services/:id` | admin | D05 |
| `GET /api/service-categories[/:idOrSlug]` · write: admin | public | D05 |
| `GET /api/procedures?service_id=` · `GET /api/procedures/:idOrSlug` · write: admin | public | D11, D12 |
| `GET /api/districts[/:id]` · write: admin | public | F25, F29 |
| `GET /api/translations/schema` · `GET/PUT /api/translations` · `DELETE /api/translations/:id` | admin | F27 |
| `POST /api/requests` | public for `CONTACT`, logged in otherwise | D04, D11, D16, F25 |
| `GET /api/requests?scope=open\|needs_action\|closed&status=&type=&assigned=me\|none&q=&sort=` | citizen: own · staff: all | F22, F26 |
| `GET /api/requests/:id` · `POST /api/requests/:id/comments` | owner or staff | D11 |
| `PATCH /api/requests/:id` (status, priority, assigned_agent_id, note) | staff | F22 |
| `DELETE /api/requests/:id` | admin | |
| `GET /api/dashboard/stats` | staff | D17, D19 |
| `GET /api/announcements` · `GET /api/announcements/:id` | public | D06 |
| `POST /api/announcements` · `PATCH /:id` · `POST /:id/publish` · `DELETE /:id` | staff | D06, F30 |
| `GET /api/alerts/active` · `GET /api/alerts/:id` | public | D18, F29, F31 |
| `GET /api/alerts` · `POST /api/alerts` · `PATCH /:id` · `POST /:id/close` | staff | D18, F29, F31 |
| `GET /api/notifications` · `GET /unread-count` · `PATCH /:id/read` · `POST /read-all` · `DELETE /:id` | logged in | F30 |
| `GET /api/terra-nova/requests` | staff | D19 (needs `TERRA_NOVA_API_KEY`, sent as `X-Webcup-Api-Key`) |

### Request types

`POST /api/requests` body: `type` (`CONTACT` | `PROCEDURE` | `INCIDENT`), `subject`, `message`, plus:
- `CONTACT` without account: `contact_name`, `contact_email`.
- `PROCEDURE`: `procedure_id` and `data` (answers to the procedure's `form_schema`; required fields are checked).
- `INCIDENT`: `location_label` or `latitude` + `longitude`; optional `category`, `district_id`, `attachment` file.

The response contains `reference` (e.g. `NT-261003-4F9A2C`) and a confirmation `message`.

### CRUD generator (simple tables)

``npm run generate:crud -- user name:string last_name:string:@unique profile:string:file email:string:@unique couverture:string:file``
