# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects with no shared tooling at the root. Run commands from inside each directory.

- `backend/`: Express 5 + TypeScript + Prisma (MySQL) REST API. Listens on `PORT` or `9002`.
- `frontend/`: React 19 + Vite + TypeScript + Tailwind CSS v4 (through `@tailwindcss/vite`, no Tailwind config file).

Neither project has a test runner configured.

## Commands

### Backend (`cd backend`)

```bash
docker compose up -d          # MySQL 5.7 on localhost:3300, phpMyAdmin on localhost:88 (credentials in docker-compose.yml)
cp .env.examle .env           # note the misspelled filename; set DATABASE_URL, optionally PORT and ENV=development
npm run dev                   # nodemon + ts-node running index.ts
npm run build                 # tsc -> dist/
npm start                     # node dist/index.js
npx prisma migrate dev        # apply schema.prisma changes (also regenerates the client)
npx prisma generate           # regenerate @prisma/client only
npm run generate:crud -- <table> <field>:<type>[:<modifier>] ...
```

`rootDir` is the backend root, so the build outputs `dist/index.js` plus `dist/src/**`. The committed `backend/index.js` is a stale compiled copy of `index.ts`, not the build output. Run `npx prisma generate` after a fresh install; otherwise the server crashes on startup when a model is imported. The JWT secret is hardcoded in `src/services/services.ts`.

### Frontend (`cd frontend`)

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint (flat config in eslint.config.js)
npm run preview
```

`tsconfig.app.json` enables `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), and `erasableSyntaxOnly` (no enums, namespaces, or parameter properties).

## Backend architecture: the CRUD generator

Most backend code is produced by `scripts/create-crud.ts`, which calls four generators in `scripts/bases/`. Example from the README:

```bash
npm run generate:crud -- user name:string last_name:string:@unique profile:string:file email:string:@unique couverture:string:file
```

For a table `foo`, the script:
1. **Appends** a `model Foo` block to `prisma/schema.prisma`, with auto `id` (autoincrement Int) and `created_at` columns. Types are capitalized and must be Prisma scalar types. Extra segments such as `@unique` are copied into the schema verbatim. The special `file` modifier is dropped from the schema, so the column is a plain String that stores the uploaded file name.
2. Writes `src/model/foo.model.ts`, a Prisma wrapper whose `getAll/getOne/create/update/delete` take **positional** arguments in field order, with file fields last.
3. Writes `src/controller/foo.controller.ts`. It reads fields from `req.body`. For each `file` field, it reads the upload from `req.files.<field>`, uses `req.body.<field>` as the file name prefix, and saves the file to `./public/` with `uploadFile` from `services.ts`.
4. Writes `src/router/foo.router.ts`: `GET /`, `GET /:id`, `POST /`, `PUT /`, `DELETE /`. Update and delete read `id` from the **request body**, not from the URL.

The generator will not overwrite existing model, controller, or router files; it exits instead. However, it has already appended to `schema.prisma` before that check runs, so a failed run can leave a duplicate model block that you have to remove by hand. The generator does **not** mount the router or run a migration. After generating:
- Import the router in `backend/index.ts` and mount it under the `// All router here` comment, for example `app.use('/api/foo', fooRouter)`. The frontend expects routes under `/api`. The `user` router is mounted at `/api/users`.
- Run `npx prisma migrate dev`.

If you edit a generated file by hand, keep the generator templates in `scripts/bases/*.generation.ts` in sync when the change should apply to future tables.

Static uploads are served at `/public`. `index.ts` resolves the folder to `./public` when `ENV=development` and to `../public` otherwise (relative to the compiled file's `__dirname`). `uploadFile` writes to `./public/` relative to the process working directory.

## Frontend ↔ backend

`frontend/src/hooks/useHttps.tsx` hardcodes the backend URLs: `http://localhost:9002/api` for the API, `/public/` for images, and `/face` for an AI endpoint that doesn't exist in the backend yet. It returns preconfigured axios instances: `http` (JSON), `fileHttp` (multipart, for generated endpoints that have `file` fields), and `aiFileHttp`. The brand palette is defined as CSS variables in `src/index.css` (`--navy: #0a2342`, `--wave: #4a90ff`). `App.tsx` also uses these hex values inline as Tailwind arbitrary values.
