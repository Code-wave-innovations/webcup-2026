# Matrice de droits éditable (D08 / D09) — design

**Date:** 2026-10-04  
**Refs:** D08 · D09  
**Scope:** Rendre la matrice `/admin/roles` éditable pour Agent et Admin ; le serveur applique les choix. Colonne Citoyen verrouillée.

## Principles

1. Les permissions restent définies en code (`PERMISSIONS` : clés, labels, routes).
2. Les **rôles accordés** par permission sont surchargeables en base (`PlatformSetting` `role_grants`).
3. **CITIZEN** n’apparaît jamais dans un grant staff ; la colonne UI est verrouillée.
4. **ADMIN** ne peut pas perdre `permissions.manage` ni `staff.manage` (anti lock-out).
5. `requirePermission(key)` remplace `requireStaff` / `requireAdmin` sur les routes de la matrice.

## API

- `GET /api/permissions` — matrice effective (`roles` fusionnés, `editable` / `locked_roles` pour l’UI).
- `PATCH /api/permissions/:key` `{ roles: ("AGENT"|"ADMIN")[] }` — admin + `permissions.manage`, audité.

## Out of scope

- Création de nouveaux rôles ou de nouvelles clés de permission.
- Édition des droits citoyen.
