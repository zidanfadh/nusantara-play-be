# Auth Module Documentation

## Overview
Auth module menangani autentikasi pengguna menggunakan Supabase. Modul ini menyediakan endpoint untuk health check dan penggantian password.

## Base URL
```
/auth
```

---

## Endpoints

### 1. Health Check

Mengecek status auth service.

**Endpoint:** `GET /auth/health`

**Authentication:** Public (tidak memerlukan token)

**Query Parameters:** None

**Request Body:** None

**Response:**
```json
{
  "status": "ok",
  "message": "Auth service is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Use Case:** Untuk monitoring dan health check service.

---

### 2. Change Password

Mengubah password pengguna yang sedang login.

**Endpoint:** `POST /auth/change-password`

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:** None

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456",
  "confirmPassword": "NewPass456"
}
```

**Request Body Schema:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| currentPassword | string | Yes | - |
| newPassword | string | Yes | Min 8 chars, harus mengandung uppercase, lowercase, dan number |
| confirmPassword | string | Yes | Harus sama dengan newPassword |

**Validation Rules:**
- `newPassword` minimum 8 karakter
- `newPassword` harus mengandung minimal 1 huruf kapital
- `newPassword` harus mengandung minimal 1 huruf kecil
- `newPassword` harus mengandung minimal 1 angka
- `confirmPassword` harus sama dengan `newPassword`
- `newPassword` tidak boleh sama dengan `currentPassword`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**

**400 Bad Request** - Password tidak match:
```json
{
  "statusCode": 400,
  "message": "New password and confirmation do not match",
  "error": "Bad Request"
}
```

**400 Bad Request** - Password sama dengan yang lama:
```json
{
  "statusCode": 400,
  "message": "New password must be different from current password",
  "error": "Bad Request"
}
```

**401 Unauthorized** - Password saat ini salah:
```json
{
  "statusCode": 401,
  "message": "Current password is incorrect",
  "error": "Unauthorized"
}
```

**Use Case:** Pengguna mengubah password mereka sendiri.

**Audit:** Endpoint ini di-log ke audit trail.

---

## Authentication Flow

### Login Flow (via Supabase)

Login tidak dilakukan melalui API ini, melainkan langsung ke Supabase:

1. Frontend memanggil Supabase Auth SDK untuk login
2. Supabase mengembalikan JWT token
3. Frontend mengirim JWT token ke API backend ini via header `Authorization: Bearer <token>`
4. Backend memverifikasi token menggunakan `JwtAuthGuard`

### Token Verification

Backend menggunakan `jwks-rsa` untuk memverifikasi JWT token dari Supabase tanpa menyimpan secret.

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error, password tidak match, etc.) |
| 401 | Unauthorized (password salah, token invalid) |
| 500 | Internal Server Error |

---

## Notes

- Password change dilakukan menggunakan Supabase Admin API
- Password lama diverifikasi dengan mencoba login menggunakan email dan password lama
- Setelah password berhasil diubah, user perlu login ulang dengan password baru
