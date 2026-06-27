# Nusantara Play Backend

> Platform Digital Arsip Permainan Rakyat Indonesia - REST API Backend

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 Deskripsi Proyek

Backend API untuk platform Nusantara Play - sistem arsip digital permainan rakyat Indonesia dengan fitur:
- Arsip permainan rakyat dengan workflow verifikasi
- Manajemen event (Teras Bermain, workshop, festival)
- Komunitas budaya lokal
- Sertifikasi digital dengan QR verification
- Sistem RBAC untuk 4 role (Admin KPOTI, Kurator Daerah, Pakar, Publik)
- Audit trail lengkap untuk transparansi

---

## 🎯 Status Implementasi

### ✅ Phase 1: Foundation MVP (SELESAI - 100%)

**Completed Tasks:**

#### 1. ✅ Configuration Module
- Centralized environment configuration
- Type-safe config access dengan NestJS ConfigModule
- Support untuk multiple environment files

**Files:**
- `src/config/config.module.ts`
- `src/config/app.config.ts`
- `src/config/database.config.ts`
- `src/config/supabase.config.ts`
- `src/config/aws.config.ts`

#### 2. ✅ Database Schema
- **13 Tables**: users, daerah, permainan, verifikasi, verifikasi_queue, events, event_registrations, communities, community_members, certificates, audit_logs, notifications, settings
- **7 ENUM Types**: user_role, user_status, daerah_level, permainan_status, verifikasi_status, event_status, certificate_type
- **35+ Indexes** untuk optimasi query
- **Foreign key constraints** lengkap
- **Triggers** untuk auto-update timestamps & search vectors
- **Full-text search** dengan Indonesian language support

**Files:**
- `src/database/migrations/001_initial_schema.sql` - Complete schema
- `src/database/seeds/initial-data.sql` - 34 provinsi Indonesia + settings
- `src/database/database.module.ts` - TypeORM configuration

#### 3. ✅ Authentication dengan Supabase JWT
- JWT strategy dengan Supabase token validation
- **JIT (Just-in-Time) user sync** - Auto-create user pada first login
- Global JWT authentication dengan opt-in public routes
- Decorators: `@Public()`, `@Roles()`, `@CurrentUser()`
- Comprehensive error handling

**Files:**
- `src/modules/auth/strategies/jwt.strategy.ts` - JWT validation & user sync
- `src/modules/auth/auth.service.ts` - Supabase client
- `src/common/guards/jwt-auth.guard.ts` - Global JWT guard
- `src/common/guards/roles.guard.ts` - RBAC enforcement
- `src/common/decorators/*` - Custom decorators
- `src/common/filters/http-exception.filter.ts` - Error handling

#### 4. ✅ Users Module dengan RBAC
- **4 User Roles**: `admin_kpoti`, `kurator_daerah`, `pakar`, `publik`
- User profile management
- Admin user & role management
- Last login tracking

**Endpoints:**
- `GET /api/users/me` - Get current user
- `PATCH /api/users/me` - Update profile
- `GET /api/users` - List users (admin only)
- `PATCH /api/users/:id/role` - Update role (admin only)

**Files:**
- `src/modules/users/entities/user.entity.ts`
- `src/modules/users/users.service.ts`
- `src/modules/users/users.controller.ts`

#### 5. ✅ Storage Module (AWS S3)
- File upload ke S3 / MinIO
- File type & size validation
- Multiple upload categories (images, avatars, documents, videos)
- Presigned URL support
- File deletion

**Endpoints:**
- `POST /api/upload/image` - Upload image
- `POST /api/upload/avatar` - Upload avatar
- `POST /api/upload/document` - Upload document (kurator+)
- `POST /api/upload/video` - Upload video (kurator+)
- `DELETE /api/upload/file` - Delete file

**Files:**
- `src/modules/storage/storage.service.ts`
- `src/modules/storage/upload.controller.ts`

#### 6. ✅ Daerah Module
- Hierarchical regional data (provinsi → kabupaten → kota)
- 34 provinsi Indonesia seeded
- All endpoints PUBLIC (no auth required)

**Endpoints:**
- `GET /api/daerah` - List regions with filters
- `GET /api/daerah/provinces` - Get all provinces
- `GET /api/daerah/stats` - Regional statistics
- `GET /api/daerah/:id/children` - Get child regions

**Files:**
- `src/modules/daerah/entities/daerah.entity.ts`
- `src/modules/daerah/daerah.service.ts`
- `src/modules/daerah/daerah.controller.ts`

#### 7. ✅ Audit Module
- Automatic audit logging untuk semua mutations
- Captures: user, action, entity, changes, IP, user agent
- Admin-only audit trail viewing

**Endpoints:**
- `GET /api/audit` - List audit logs (admin only)
- `GET /api/audit/entity/:type/:id` - Entity audit trail
- `GET /api/audit/user/:id` - User audit trail

**Files:**
- `src/modules/audit/entities/audit-log.entity.ts`
- `src/modules/audit/audit.service.ts`
- `src/modules/audit/audit.interceptor.ts`
- `src/modules/audit/audit.controller.ts`

#### 8. ✅ Global Security Setup
- ✅ Helmet - Security headers
- ✅ CORS - Frontend origin only
- ✅ Rate Limiting - 100 req/min
- ✅ Global Validation Pipe - Input validation
- ✅ Global Exception Filter - Consistent errors
- ✅ Global JWT Guard - Protected by default
- ✅ API Prefix - All endpoints under `/api`

**Files:**
- `src/main.ts` - Bootstrap with security
- `src/app.module.ts` - Root module with all integrations

---

### 📊 Implementation Stats

**Total Files Created:** 50+ production-ready files
**Lines of Code:** ~3,500+ lines of TypeScript
**Database Tables:** 13 tables with full relationships
**API Endpoints:** 20+ endpoints (public + authenticated)
**Security Layers:** 7 security features implemented

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ & npm
- PostgreSQL 15+
- Supabase account
- AWS S3 account (or MinIO for local dev)

### 1. Installation

```bash
# Clone repository
git clone <repository-url>
cd nusantara-play-backend

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# - DATABASE_* (PostgreSQL connection)
# - SUPABASE_* (Supabase credentials)
# - AWS_* (S3 credentials)
```

**Required Environment Variables:**

```bash
# Application
NODE_ENV=development
PORT=3000
APP_NAME=Nusantara Play

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=nusantara_play

# Supabase Auth
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

# AWS S3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=nusantara-play-storage

# CORS
FRONTEND_URLS=http://localhost:3001,https://nusantaralegacy.org,https://nusantaravirtual.org
# Legacy single-origin fallback if FRONTEND_URLS is unset:
# FRONTEND_URL=http://localhost:3001
```

### 3. Database Setup

**Option A - Docker PostgreSQL (Recommended):**

```bash
docker run -d \
  --name nusantara-postgres \
  -e POSTGRES_DB=nusantara_play \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15-alpine
```

**Option B - Local PostgreSQL:**

```bash
psql -U postgres
CREATE DATABASE nusantara_play;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 4. Run Migrations

```bash
# Run schema migration
psql -U postgres -d nusantara_play -f src/database/migrations/001_initial_schema.sql

# Run seed data (34 provinces + settings)
psql -U postgres -d nusantara_play -f src/database/seeds/initial-data.sql
```

### 5. Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API**:
   - Copy `URL` → `SUPABASE_URL`
   - Copy `anon public` → `SUPABASE_ANON_KEY`
   - Copy `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to **Project Settings → API → JWT Settings**:
   - Copy `JWT Secret` → `SUPABASE_JWT_SECRET`
4. Go to **Authentication → Providers**:
   - Enable **Email** provider
   - Disable "Confirm email" for development
5. Go to **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3001`
   - Redirect URLs: `http://localhost:3001/**`

### 6. Storage Setup

**Option A - AWS S3:**

```bash
# Create S3 bucket
aws s3 mb s3://nusantara-play-storage --region ap-southeast-1

# Set bucket policy for public images
# (See plan for full bucket policy JSON)
```

**Option B - MinIO (Local Development):**

```bash
# Run MinIO container
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Access console at http://localhost:9001
# Create bucket: nusantara-play-storage
```

### 7. Start Development Server

```bash
# Start in watch mode
npm run start:dev

# Server will start at http://localhost:3000
# API available at http://localhost:3000/api
```

---

## 🧪 Testing the API

### Health Check

```bash
# API health check
curl http://localhost:3000/api/health

# Response:
# {
#   "status": "ok",
#   "message": "Nusantara Play API is running",
#   "timestamp": "2026-01-29T..."
# }
```

### Public Endpoints (No Auth)

```bash
# Get all provinces
curl http://localhost:3000/api/daerah/provinces

# Get regional stats
curl http://localhost:3000/api/daerah/stats
```

### Authenticated Endpoints

```bash
# Get current user profile (requires Supabase JWT)
curl -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  http://localhost:3000/api/users/me

# Upload image
curl -X POST \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -F "file=@image.jpg" \
  http://localhost:3000/api/upload/image
```

---

## 📐 Architecture

### Tech Stack

- **Framework**: NestJS 11.0
- **Language**: TypeScript 5.7
- **ORM**: TypeORM (decorator-based entities)
- **Database**: PostgreSQL 15
- **Authentication**: Supabase Auth + JWT
- **Storage**: AWS S3 / MinIO
- **Validation**: class-validator + class-transformer
- **Security**: Helmet, CORS, Rate Limiting

### Project Structure

```
src/
├── common/                    # Shared utilities
│   ├── decorators/           # @Roles, @CurrentUser, @Public
│   ├── guards/               # JwtAuthGuard, RolesGuard
│   ├── filters/              # HttpExceptionFilter
│   └── interfaces/           # JwtPayload
│
├── config/                    # Configuration modules
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── supabase.config.ts
│   └── aws.config.ts
│
├── database/                  # Database layer
│   ├── migrations/           # SQL migrations
│   └── seeds/                # Seed data
│
├── modules/
│   ├── auth/                 # Authentication
│   │   ├── strategies/       # JwtStrategy
│   │   ├── auth.service.ts
│   │   └── auth.controller.ts
│   │
│   ├── users/                # User management
│   │   ├── entities/         # User entity
│   │   ├── dto/              # DTOs
│   │   ├── users.service.ts
│   │   └── users.controller.ts
│   │
│   ├── daerah/               # Regional data
│   ├── storage/              # File storage
│   └── audit/                # Audit logging
│
├── main.ts                    # Bootstrap
└── app.module.ts              # Root module
```

### Security Features

1. **Helmet** - HTTP security headers (XSS, CSP, etc.)
2. **CORS** - Cross-Origin Resource Sharing
3. **Rate Limiting** - 100 requests per minute
4. **JWT Authentication** - Global guard, opt-in public routes
5. **Input Validation** - class-validator on all DTOs
6. **RBAC** - Role-based access control
7. **Audit Trail** - Automatic logging of all mutations

### Authentication Flow

```
1. User logs in via Supabase (frontend)
2. Frontend receives JWT token from Supabase
3. Frontend sends: Authorization: Bearer <token>
4. Backend validates JWT with SUPABASE_JWT_SECRET
5. JwtStrategy extracts user from token
6. If user not in DB → auto-create with 'publik' role (JIT sync)
7. User attached to request.user
8. RolesGuard checks permissions
```

### RBAC Matrix

| Role | Permissions |
|------|-------------|
| `admin_kpoti` | Full system access, manage users, view audit logs |
| `kurator_daerah` | Create/update permainan for region, upload files |
| `pakar` | Verify permainan, view verification queue |
| `publik` | View public data only (default for new users) |

---

## 📚 API Documentation

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | API information |
| GET | `/api/health` | Health check |
| GET | `/api/daerah` | List regions (with filters) |
| GET | `/api/daerah/provinces` | Get all provinces |
| GET | `/api/daerah/stats` | Regional statistics |
| GET | `/api/daerah/:id` | Get region by ID |
| GET | `/api/daerah/:id/children` | Get child regions |

### Authenticated Endpoints

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/users/me` | All | Get current user |
| PATCH | `/api/users/me` | All | Update profile |
| GET | `/api/users` | admin_kpoti | List all users |
| PATCH | `/api/users/:id/role` | admin_kpoti | Update user role |
| POST | `/api/upload/image` | All | Upload image |
| POST | `/api/upload/avatar` | All | Upload avatar |
| POST | `/api/upload/document` | kurator+, pakar, admin | Upload document |
| POST | `/api/upload/video` | kurator+, admin | Upload video |
| DELETE | `/api/upload/file` | kurator+, admin | Delete file |
| GET | `/api/audit` | admin_kpoti | List audit logs |
| GET | `/api/audit/entity/:type/:id` | admin, pakar | Entity audit trail |

---

## 🗄️ Database Schema

### Core Tables

**Users & Auth:**
- `users` - User accounts dengan 4 roles
- `daerah` - Hierarchical regional data (34 provinsi)

**Permainan (Phase 2):**
- `permainan` - Games archive
- `verifikasi` - Verification history
- `verifikasi_queue` - Verification queue

**Events & Communities (Phase 2):**
- `events` - Event management
- `event_registrations` - Event registrations
- `communities` - Communities
- `community_members` - Community membership

**System:**
- `certificates` - Digital certificates
- `audit_logs` - Audit trail
- `notifications` - Notifications
- `settings` - System settings

---

## 🔄 Next Steps - Phase 2

### Permainan Module (Ready to Implement)

**Database Schema:** ✅ Already created
**Dependencies:** ✅ Auth, RBAC, Storage, Audit ready

**Tasks:**
1. Create `src/modules/permainan/entities/permainan.entity.ts`
2. Create `src/modules/permainan/permainan.service.ts` with:
   - CRUD operations
   - Status workflow (draft → dikurasi → diverifikasi → arsip_nasional)
   - Search & filter (by daerah, kategori, status)
   - Pagination
3. Create `src/modules/permainan/permainan.controller.ts` with RBAC:
   - `POST /api/permainan` (kurator only)
   - `GET /api/permainan` (public - published only)
   - `GET /api/permainan/:id` (public)
   - `PATCH /api/permainan/:id` (kurator - own region only)
   - `DELETE /api/permainan/:id` (admin only)

**Estimated Time:** 4-6 hours

---

### Verifikasi Workflow (Phase 3)

**Database Schema:** ✅ Already created

**Tasks:**
1. Create verifikasi module
2. Implement queue management
3. Pakar assignment logic
4. Approval/rejection workflow
5. Revision tracking

**Estimated Time:** 6-8 hours

---

### Events Module (Phase 4)

**Tasks:**
1. Event CRUD with registration
2. Check-in system
3. Certificate generation

**Estimated Time:** 8-10 hours

---

## 📝 Development Notes

### Why TypeORM (Not Prisma)?

✅ **TypeORM sudah diimplementasikan** dalam project ini:
- Decorator-based entities cocok dengan NestJS philosophy
- Battle-tested dengan NestJS ecosystem
- Native migration support
- Excellent untuk complex queries

**Bisa migrasi ke Prisma nanti** jika dibutuhkan:
- Prisma punya better type safety
- Cleaner schema definition
- Better performance untuk beberapa use case

**Trade-off terdokumentasi** - TypeORM optimal untuk MVP ini.

### Code Quality

- ✅ TypeScript strict mode enabled
- ✅ ESLint + Prettier configured
- ✅ Class-validator untuk semua DTOs
- ✅ Error handling comprehensive
- ✅ Security best practices
- ✅ Modular architecture

### Testing Strategy (To Be Implemented)

- Unit tests untuk services
- E2E tests untuk critical flows
- Integration tests untuk auth & RBAC

---

## 🐛 Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -U postgres -h localhost -p 5432 -d nusantara_play
```

### Supabase JWT Error

```bash
# Verify JWT secret in .env matches Supabase project
# Get from: Supabase Dashboard → Settings → API → JWT Settings
```

### S3 Upload Error

```bash
# Check AWS credentials
aws s3 ls s3://nusantara-play-storage

# For MinIO, check console at http://localhost:9001
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 👥 Contributors

- **Development Team**: Openlitera - Nusantara Play Team
- **Framework**: Built with [NestJS](https://nestjs.com/)
- **Created**: January 2026

---

## 📞 Support

For issues and questions:
1. Check existing documentation
2. Review error logs
3. Consult NestJS documentation: https://docs.nestjs.com
4. Check Supabase docs: https://supabase.com/docs

---

**Last Updated:** 2026-01-29
**Version:** 1.0.0 (Foundation MVP Complete)
**Status:** ✅ Phase 1 Complete | 🔄 Ready for Phase 2
