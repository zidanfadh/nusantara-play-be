# Users Module Documentation

## Overview
Users module menangani manajemen data pengguna termasuk profil, role, dan status. Semua operasi user dibuat melalui Supabase Auth, kemudian data tambahan disimpan di database ini.

## Base URL
```
/users
```

---

## Data Model

### User Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| supabase_user_id | UUID | Yes | ID dari Supabase Auth (unique) |
| email | string | Yes | Email pengguna (unique) |
| full_name | string | Yes | Nama lengkap |
| role | enum | Yes | `admin_kpoti`, `kurator_daerah`, `pakar`, `publik` (default: publik) |
| status | enum | Yes | `active`, `inactive`, `suspended` (default: active) |
| phone | string | No | Nomor telepon |
| avatar_url | string | No | URL foto profil |
| bio | text | No | Bio/deskripsi singkat |
| daerah_id | UUID | No | ID daerah (foreign key) |
| institution | string | No | Nama institusi |
| expertise | string[] | No | Array keahlian/area of expertise |
| last_login_at | timestamp | No | Terakhir kali login |
| created_at | timestamp | Auto | Tanggal dibuat |
| updated_at | timestamp | Auto | Tanggal diupdate |
| created_by | UUID | No | ID user yang membuat |
| updated_by | UUID | No | ID user yang terakhir mengupdate |

---

## Endpoints

### 1. Get Current User Profile

Mengambil profil user yang sedang login.

**Endpoint:** `GET /users/me`

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:** None

**Request Body:** None

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "supabase_user_id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "publik",
  "status": "active",
  "phone": "+628123456789",
  "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/file.jpg",
  "bio": "Saya seorang penari tradisional",
  "daerah_id": "550e8400-e29b-41d4-a716-446655440002",
  "institution": "Universitas Indonesia",
  "expertise": ["Tari Bali", "Tari Jawa"],
  "last_login_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "created_by": null,
  "updated_by": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Use Case:** Menampilkan profil user di halaman profile/settings.

---

### 2. Update Current User Profile

Mengupdate profil user yang sedang login.

**Endpoint:** `PATCH /users/me`

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Query Parameters:** None

**Request Body:**
```json
{
  "full_name": "John Updated",
  "phone": "+628987654321",
  "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/new-file.jpg",
  "bio": "Bio yang sudah diupdate",
  "daerah_id": "550e8400-e29b-41d4-a716-446655440003",
  "institution": "Institut Seni Indonesia",
  "expertise": ["Tari Bali", "Tari Jawa", "Tari Sunda"]
}
```

**Request Body Schema (UpdateUserDto):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| full_name | string | No | Nama lengkap |
| phone | string | No | Nomor telepon |
| avatar_url | string | No | URL foto profil (dari upload API) |
| bio | string | No | Bio/deskripsi singkat |
| daerah_id | UUID | No | ID daerah (harus valid) |
| institution | string | No | Nama institusi |
| expertise | string[] | No | Array keahlian |

**Note:** Semua field optional. Hanya field yang dikirim yang akan diupdate.

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "supabase_user_id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "full_name": "John Updated",
  "role": "publik",
  "status": "active",
  "phone": "+628987654321",
  "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/new-file.jpg",
  "bio": "Bio yang sudah diupdate",
  "daerah_id": "550e8400-e29b-41d4-a716-446655440003",
  "institution": "Institut Seni Indonesia",
  "expertise": ["Tari Bali", "Tari Jawa", "Tari Sunda"],
  "last_login_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-15T11:00:00.000Z",
  "created_by": null,
  "updated_by": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Use Case:** User mengupdate profil mereka sendiri.

---

### 3. Get All Users (Paginated)

Mengambil list semua user dengan filter dan pagination. Hanya untuk admin.

**Endpoint:** `GET /users`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| role | string | No | - | Filter by role: `admin_kpoti`, `kurator_daerah`, `pakar`, `publik` |
| status | string | No | - | Filter by status: `active`, `inactive`, `suspended` |
| daerah_id | string | No | - | Filter by daerah ID |
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Request Examples:**
```
GET /users?page=1&limit=20
GET /users?role=pakar&status=active
GET /users?daerah_id=550e8400-e29b-41d4-a716-446655440002&page=1&limit=10
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "supabase_user_id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "user1@example.com",
      "full_name": "User One",
      "role": "publik",
      "status": "active",
      "phone": null,
      "avatar_url": null,
      "bio": null,
      "daerah_id": null,
      "institution": null,
      "expertise": null,
      "last_login_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "created_by": null,
      "updated_by": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "supabase_user_id": "550e8400-e29b-41d4-a716-446655440003",
      "email": "user2@example.com",
      "full_name": "User Two",
      "role": "pakar",
      "status": "active",
      "phone": "+628123456789",
      "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/file.jpg",
      "bio": "Ahli tari tradisional",
      "daerah_id": "550e8400-e29b-41d4-a716-446655440004",
      "institution": "Universitas Indonesia",
      "expertise": ["Tari Bali", "Tari Jawa"],
      "last_login_at": "2024-01-14T08:00:00.000Z",
      "created_at": "2024-01-02T00:00:00.000Z",
      "updated_at": "2024-01-14T08:00:00.000Z",
      "created_by": null,
      "updated_by": null
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| data | User[] | Array of user objects |
| pagination | object | Pagination metadata |
| pagination.total | number | Total jumlah semua records |
| pagination.page | number | Halaman saat ini |
| pagination.limit | number | Jumlah items per halaman |
| pagination.totalPages | number | Total jumlah halaman |
| pagination.hasNext | boolean | Ada halaman selanjutnya atau tidak |
| pagination.hasPrev | boolean | Ada halaman sebelumnya atau tidak |

**Use Case:** Admin melihat dan mengelola semua user.

---

### 4. Get User Statistics

Mengambil statistik user. Hanya untuk admin.

**Endpoint:** `GET /users/stats`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:** None

**Request Body:** None

**Success Response (200 OK):**
```json
{
  "total": 150
}
```

**Use Case:** Dashboard admin untuk melihat total user.

---

### 5. Get User by ID

Mengambil data user spesifik berdasarkan ID.

**Endpoint:** `GET /users/:id`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`, `kurator_daerah`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID user yang ingin diambil |

**Request Examples:**
```
GET /users/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "supabase_user_id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "publik",
  "status": "active",
  "phone": "+628123456789",
  "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/file.jpg",
  "bio": "Saya seorang penari tradisional",
  "daerah_id": "550e8400-e29b-41d4-a716-446655440002",
  "institution": "Universitas Indonesia",
  "expertise": ["Tari Bali", "Tari Jawa"],
  "last_login_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "created_by": null,
  "updated_by": null
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "User with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

**Use Case:** Admin/kurator melihat detail user tertentu.

---

### 6. Update User Role

Mengubah role user. Hanya admin.

**Endpoint:** `PATCH /users/:id/role`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID user yang ingin diubah rolenya |

**Request Body:**
```json
{
  "role": "pakar"
}
```

**Request Body Schema (UpdateRoleDto):**

| Field | Type | Required | Options |
|-------|------|----------|---------|
| role | string | Yes | `admin_kpoti`, `kurator_daerah`, `pakar`, `publik` |

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "supabase_user_id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "pakar",
  "status": "active",
  "phone": "+628123456789",
  "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/file.jpg",
  "bio": "Saya seorang penari tradisional",
  "daerah_id": "550e8400-e29b-41d4-a716-446655440002",
  "institution": "Universitas Indonesia",
  "expertise": ["Tari Bali", "Tari Jawa"],
  "last_login_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z",
  "created_by": null,
  "updated_by": "550e8400-e29b-41d4-a716-446655440099"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "User with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

**Use Case:** Admin mengubah role user (misal: mengangkat user publik menjadi pakar).

---

### 7. Update User Status

Mengubah status user. Hanya admin.

**Endpoint:** `PATCH /users/:id/status`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID user yang ingin diubah statusnya |

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Request Body Schema:**

| Field | Type | Required | Options |
|-------|------|----------|---------|
| status | string | Yes | `active`, `inactive`, `suspended` |

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "supabase_user_id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "publik",
  "status": "suspended",
  "phone": "+628123456789",
  "avatar_url": "https://s3.amazonaws.com/bucket/images/avatars/file.jpg",
  "bio": "Saya seorang penari tradisional",
  "daerah_id": "550e8400-e29b-41d4-a716-446655440002",
  "institution": "Universitas Indonesia",
  "expertise": ["Tari Bali", "Tari Jawa"],
  "last_login_at": "2024-01-15T10:30:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z",
  "created_by": null,
  "updated_by": "550e8400-e29b-41d4-a716-446655440099"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "User with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

**Use Case:** Admin menonaktifkan/menangguhkan user bermasalah.

---

## Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin_kpoti` | Super admin | Full access ke semua endpoint |
| `kurator_daerah` | Kurator per daerah | Get user by ID, update user di daerahnya |
| `pakar` | Ahli/Pakar | - |
| `publik` | User biasa | Get/update profil sendiri saja |

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (token invalid/expired) |
| 403 | Forbidden (tidak memiliki permission) |
| 404 | Not Found (user tidak ditemukan) |
| 500 | Internal Server Error |

---

## Notes

- User dibuat otomatis saat pertama kali login via Supabase
- `supabase_user_id` adalah link antara Supabase Auth dan database ini
- Password disimpan di Supabase, tidak di database ini
- `last_login_at` diupdate secara otomatis saat user login
