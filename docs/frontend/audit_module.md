# Audit Module Documentation

## Overview
Audit module menangani logging aktivitas yang terjadi di sistem. Setiap operasi penting (create, update, delete) akan di-log ke audit trail untuk keamanan dan tracking.

## Base URL
```
/audit
```

---

## Data Model

### AuditLog Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Auto | Primary key |
| user_id | UUID | No | ID user yang melakukan aksi |
| action | string | Yes | Jenis aksi (create, update, delete, dll.) |
| entity_type | string | Yes | Tipe entity (user, daerah, content, dll.) |
| entity_id | UUID | No | ID entity yang di-aksikan |
| changes | jsonb | No | Data perubahan (before/after) |
| ip_address | string | No | IP address pengguna |
| user_agent | text | No | Browser/device info |
| created_at | timestamp | Auto | Waktu aksi dilakukan |

---

## Endpoints

### 1. Get All Audit Logs

Mengambil semua audit logs dengan filter dan pagination. Hanya untuk admin.

**Endpoint:** `GET /audit`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| user_id | string (UUID) | No | - | Filter by user ID |
| entity_type | string | No | - | Filter by entity type (misal: "user", "daerah") |
| entity_id | string (UUID) | No | - | Filter by entity ID |
| action | string | No | - | Filter by action (misal: "create", "update", "delete") |
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Request Examples:**
```
GET /audit?page=1&limit=20
GET /audit?user_id=550e8400-e29b-41d4-a716-446655440000
GET /audit?entity_type=user&action=update
GET /audit?entity_id=550e8400-e29b-41d4-a716-446655440002&page=1&limit=10
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "update",
      "entity_type": "user",
      "entity_id": "550e8400-e29b-41d4-a716-446655440002",
      "changes": {
        "before": {
          "role": "publik",
          "status": "active"
        },
        "after": {
          "role": "pakar",
          "status": "active"
        }
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440101",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "delete",
      "entity_type": "content",
      "entity_id": "550e8400-e29b-41d4-a716-446655440300",
      "changes": {
        "deleted": {
          "id": "550e8400-e29b-41d4-a716-446655440300",
          "title": "Tari Piring",
          "description": "Tarian tradisional dari Minangkabau"
        }
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2024-01-15T09:15:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| data | AuditLog[] | Array of audit log objects |
| pagination | object | Pagination metadata |
| pagination.total | number | Total jumlah semua records (sesuai filter) |
| pagination.page | number | Halaman saat ini |
| pagination.limit | number | Jumlah items per halaman |
| pagination.totalPages | number | Total jumlah halaman |
| pagination.hasNext | boolean | Ada halaman selanjutnya atau tidak |
| pagination.hasPrev | boolean | Ada halaman sebelumnya atau tidak |

**Use Case:** Admin melihat semua aktivitas yang terjadi di sistem.

---

### 2. Get Audit Logs by Entity

Mengambil audit logs untuk entity tertentu dengan pagination. Untuk admin dan pakar.

**Endpoint:** `GET /audit/entity/:type/:id`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`, `pakar`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | Tipe entity (misal: "user", "daerah", "content") |
| id | string (UUID) | Yes | ID entity yang ingin dilihat auditnya |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Request Examples:**
```
GET /audit/entity/user/550e8400-e29b-41d4-a716-446655440000
GET /audit/entity/daerah/550e8400-e29b-41d4-a716-446655440002?page=2&limit=20
GET /audit/entity/content/550e8400-e29b-41d4-a716-446655440300
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "user_id": "550e8400-e29b-41d4-a716-446655440099",
      "action": "create",
      "entity_type": "user",
      "entity_id": "550e8400-e29b-41d4-a716-446655440000",
      "changes": {
        "created": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "email": "user@example.com",
          "full_name": "John Doe",
          "role": "publik"
        }
      },
      "ip_address": "192.168.1.50",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2024-01-01T08:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440101",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "update",
      "entity_type": "user",
      "entity_id": "550e8400-e29b-41d4-a716-446655440000",
      "changes": {
        "before": {
          "full_name": "John Doe",
          "bio": null
        },
        "after": {
          "full_name": "John Updated",
          "bio": "Bio baru"
        }
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Note:** Response diurutkan dari yang terbaru (descending by created_at).

**Use Case:** Melihat riwayat perubahan pada entity tertentu (misal: riwayat perubahan profil user).

---

### 3. Get Audit Logs by User

Mengambil audit logs yang dilakukan oleh user tertentu dengan pagination. Hanya untuk admin.

**Endpoint:** `GET /audit/user/:id`

**Authentication:** Required (JWT Token)
**Authorization:** `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | ID user yang ingin dilihat aktivitasnya |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Halaman yang ingin diambil |
| limit | number | No | 10 | Jumlah items per halaman |

**Request Examples:**
```
GET /audit/user/550e8400-e29b-41d4-a716-446655440000
GET /audit/user/550e8400-e29b-41d4-a716-446655440000?page=2&limit=20
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "update",
      "entity_type": "user",
      "entity_id": "550e8400-e29b-41d4-a716-446655440002",
      "changes": {
        "before": {
          "role": "publik"
        },
        "after": {
          "role": "pakar"
        }
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440101",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "create",
      "entity_type": "content",
      "entity_id": "550e8400-e29b-41d4-a716-446655440300",
      "changes": {
        "created": {
          "title": "Tari Piring",
          "description": "Tarian tradisional dari Minangkabau"
        }
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "created_at": "2024-01-14T15:20:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Note:** Response diurutkan dari yang terbaru (descending by created_at).

**Use Case:** Admin melihat aktivitas yang dilakukan oleh user tertentu (untuk audit security).

---

## Audit Interceptor

Audit module menggunakan `AuditInterceptor` yang otomatis mencatat operasi penting.

### Endpoints yang di-log:

Otomatis di-log untuk endpoints dengan decorator `@UseInterceptors(AuditInterceptor)`:

- **Auth change password** - action: `change_password`
- **User update profile** - action: `update_profile`
- **User update role** - action: `update_role`
- **User update status** - action: `update_status`

### Struktur changes:

**Untuk Create:**
```json
{
  "changes": {
    "created": {
      "id": "...",
      "field1": "value1",
      "field2": "value2"
    }
  }
}
```

**Untuk Update:**
```json
{
  "changes": {
    "before": {
      "field1": "old_value",
      "field2": "old_value"
    },
    "after": {
      "field1": "new_value",
      "field2": "new_value"
    }
  }
}
```

**Untuk Delete:**
```json
{
  "changes": {
    "deleted": {
      "id": "...",
      "field1": "value1",
      "field2": "value2"
    }
  }
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 401 | Unauthorized (token invalid/expired) |
| 403 | Forbidden (tidak memiliki permission) |
| 500 | Internal Server Error |

---

## Notes

- Audit logs bersifat read-only, tidak bisa diubah/dihapus
- `user_id` bisa null jika aksi dilakukan oleh system
- `ip_address` dan `user_agent` otomatis diambil dari request
- `changes` menyimpan data sebelum dan sesudah untuk update operation
- Audit log diurutkan dari yang terbaru (descending by created_at)
- Semua endpoint list menggunakan pagination untuk performance
