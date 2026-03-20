# CLAUDE.md — Nusantara Play Backend

> **Full project context:** see `../CLAUDE.md` in the root repo.

## Project Overview

NestJS 11 backend for Nusantara Play — a digital archive platform for Indonesian traditional
games and sports (PROT). Features JWT auth via Supabase, TypeORM + PostgreSQL, RBAC,
blockchain anchoring on Polygon, and AWS S3 file storage.

## Commands

```bash
npm run start:dev           # Start with hot reload (http://localhost:3000)
npm run build               # Compile TypeScript
npm run lint                # ESLint + Prettier fix
npm test                    # Run all unit tests (jest)
npm test -- --testPathPattern=prot.service   # Run single test file
npm run test:e2e            # E2E tests
npm run migration:run       # Run SQL migrations via TypeORM CLI
npm run seed                # Seed 34 provinces + settings
```

## Git Workflow

This is a standalone git repo. Run all git commands directly — no need to `cd` first.

```bash
# Correct — plain git commands in this directory
git add src/modules/marketplace/order.service.ts
git commit -m "feat(marketplace): add order service"
```

Never chain navigation with git using `&&` — always run them as separate commands.

## Architecture

**All endpoints are under `/api` prefix** and protected by JWT by default.
- Use `@Public()` to expose a route without auth.
- Use `@Roles('admin_kpoti', ...)` for RBAC enforcement.
- Use `@CurrentUser()` to get the authenticated user in a controller.

**Auth flow**: Frontend gets JWT from Supabase → sends `Authorization: Bearer <token>` →
`JwtStrategy` validates against `SUPABASE_JWT_SECRET` → if user not in DB, auto-creates
with `publik` role (JIT sync).

**Module structure** (`src/modules/`):
- `auth/` — JWT strategy, Supabase client
- `users/` — profile management, admin role assignment
- `prot/` — PROT CRUD + verification workflow
- `blockchain/` — Polygon anchoring via ethers.js
- `events/` — event CRUD + registration
- `calendar/` — personal/team calendar, invites
- `daerah/` — hierarchical Indonesian regional data; all endpoints `@Public()`
- `storage/` — AWS S3 / MinIO file uploads
- `audit/` — automatic audit logging interceptor (global, covers all mutations)
- `marketplace/` — marketplace: toko, produk, order
- `supabase/` — shared Supabase admin client

**Common utilities** (`src/common/`):
- `decorators/` — `@Public()`, `@Roles()`, `@CurrentUser()`
- `guards/` — `JwtAuthGuard` (global), `RolesGuard`
- `filters/` — `HttpExceptionFilter` for consistent error responses

## Domain Model

**PROT status workflow**: `DRAFT` → `DIKURASI` → `DIVERIFIKASI` → `ARSIP_NASIONAL` (with `REVISI` as returnable state)

**Roles** (stored in app DB, not Supabase):
| Role | Access |
|------|--------|
| `admin_kpoti` | Full access, publish to national archive, manage users |
| `kurator_daerah` | Input and edit PROT for their region |
| `pakar` | Verify/reject/request revisions on PROT |
| `publik` | Read-only (default for new users) |

**Marketplace order status**: `menunggu` → `dikonfirmasi` → `dikirim` → `selesai` (or `dibatalkan`)

## Key Conventions

- New DTOs must use `class-validator` decorators; global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true`.
- TypeORM entities live in `src/modules/<module>/entities/`.
- Migrations use timestamp filenames: `src/migrations/<timestamp>-<Name>.ts`. Run raw SQL inside `queryRunner.query()`.
- Ownership checks (ForbiddenException) go in the **service layer**, not guards.
- Use TypeORM transactions (`DataSource.createQueryRunner()`) for any multi-table write that must be atomic (e.g. order creation + stock decrement).
- For file uploads (multipart), the frontend uses raw `fetch` with `FormData` — do not set `Content-Type` manually.

## Env Vars

`DATABASE_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET`, `AWS_*`, `FRONTEND_URL`
