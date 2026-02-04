# Storage Module Documentation

## Overview
Storage module menangani upload dan delete file ke AWS S3. Module ini mendukung upload image, avatar, document, dan video dengan validasi tipe dan ukuran file.

## Base URL
```
/upload
```

---

## S3 Configuration

Storage module menggunakan AWS S3 dengan konfigurasi:

| Config | Description |
|--------|-------------|
| Region | AWS Region (dari environment variable) |
| Bucket | Nama S3 bucket (dari environment variable) |
| Access Key | AWS Access Key ID |
| Secret Key | AWS Secret Access Key |

### File Access Level

| Folder | Access Level | URL Format |
|--------|--------------|------------|
| `images/` | Public read | `https://{bucket}.s3.{region}.amazonaws.com/images/{filename}` |
| `images/avatars/` | Public read | `https://{bucket}.s3.{region}.amazonaws.com/images/avatars/{filename}` |
| `documents/` | Private | Tidak ada public URL, perlu presigned URL |
| `videos/` | Private | Tidak ada public URL, perlu presigned URL |

---

## File Validation

### Allowed MIME Types

| Type | MIME Types |
|------|------------|
| Image | `image/jpeg`, `image/jpg`, `image/png` |
| Document | `application/pdf` |
| Video | `video/mp4` |

### Size Limit
- Maximum file size: **10 MB**

### Auto-generated Filename
- Filename digenerate menggunakan UUID untuk menghindari conflict
- Format: `{uuid}.{extension}`

---

## Endpoints

### 1. Upload Image

Upload file gambar (JPEG, JPG, PNG) ke S3 folder `images/`. File bersifat public.

**Endpoint:** `POST /upload/image`

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File gambar (JPEG, JPG, PNG) max 10MB |

**Request Example (FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileObject);

fetch('/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (200 OK):**
```json
{
  "url": "https://my-bucket.s3.ap-southeast-1.amazonaws.com/images/550e8400-e29b-41d4-a716-446655440000.jpg",
  "message": "Image uploaded successfully"
}
```

**Error Response (400 Bad Request) - No file:**
```json
{
  "statusCode": 400,
  "message": "No file provided",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - File too large:**
```json
{
  "statusCode": 400,
  "message": "File size exceeds 10MB limit",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - Invalid type:**
```json
{
  "statusCode": 400,
  "message": "File type application/pdf is not allowed. Allowed types: image/jpeg, image/jpg, image/png, application/pdf, video/mp4",
  "error": "Bad Request"
}
```

**Use Case:** Upload gambar untuk konten (foto tari, foto baju adat, dll.)

**Note:** URL yang dikembalikan bisa langsung diakses publicly.

---

### 2. Upload Avatar

Upload file avatar (JPEG, JPG, PNG) ke S3 folder `images/avatars/`. File bersifat public.

**Endpoint:** `POST /upload/avatar`

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File gambar (JPEG, JPG, PNG) max 10MB |

**Request Example (FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileObject);

fetch('/upload/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (200 OK):**
```json
{
  "url": "https://my-bucket.s3.ap-southeast-1.amazonaws.com/images/avatars/550e8400-e29b-41d4-a716-446655440000.jpg",
  "message": "Avatar uploaded successfully"
}
```

**Error Response (400 Bad Request) - No file:**
```json
{
  "statusCode": 400,
  "message": "No file provided",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - File too large:**
```json
{
  "statusCode": 400,
  "message": "File size exceeds 10MB limit",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - Invalid type:**
```json
{
  "statusCode": 400,
  "message": "File type application/pdf is not allowed. Allowed types: image/jpeg, image/jpg, image/png, application/pdf, video/mp4",
  "error": "Bad Request"
}
```

**Use Case:** Upload foto profil user.

**Note:** URL yang dikembalikan bisa langsung diakses publicly. Setelah upload, simpan URL ke field `avatar_url` di user profile.

---

### 3. Upload Document

Upload file dokumen (PDF) ke S3 folder `documents/`. File bersifat private. Hanya untuk kurator, pakar, dan admin.

**Endpoint:** `POST /upload/document`

**Authentication:** Required (JWT Token)
**Authorization:** `kurator_daerah`, `pakar`, `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File PDF max 10MB |

**Request Example (FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileObject);

fetch('/upload/document', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (200 OK):**
```json
{
  "url": "https://my-bucket.s3.ap-southeast-1.amazonaws.com/documents/550e8400-e29b-41d4-a716-446655440000.pdf",
  "message": "Document uploaded successfully"
}
```

**Error Response (400 Bad Request) - No file:**
```json
{
  "statusCode": 400,
  "message": "No file provided",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - File too large:**
```json
{
  "statusCode": 400,
  "message": "File size exceeds 10MB limit",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - Invalid type:**
```json
{
  "statusCode": 400,
  "message": "File type image/jpeg is not allowed. Allowed types: image/jpeg, image/jpg, image/png, application/pdf, video/mp4",
  "error": "Bad Request"
}
```

**Error Response (403 Forbidden) - Unauthorized:**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Forbidden"
}
```

**Use Case:** Upload dokumen penelitian, materi pembelajaran, dll.

**Note:** URL tidak bisa diakses secara langsung (private). Perlu presigned URL untuk download.

---

### 4. Upload Video

Upload file video (MP4) ke S3 folder `videos/`. File bersifat private. Hanya untuk kurator dan admin.

**Endpoint:** `POST /upload/video`

**Authentication:** Required (JWT Token)
**Authorization:** `kurator_daerah`, `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | File video MP4 max 10MB |

**Request Example (FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileObject);

fetch('/upload/video', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (200 OK):**
```json
{
  "url": "https://my-bucket.s3.ap-southeast-1.amazonaws.com/videos/550e8400-e29b-41d4-a716-446655440000.mp4",
  "message": "Video uploaded successfully"
}
```

**Error Response (400 Bad Request) - No file:**
```json
{
  "statusCode": 400,
  "message": "No file provided",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - File too large:**
```json
{
  "statusCode": 400,
  "message": "File size exceeds 10MB limit",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - Invalid type:**
```json
{
  "statusCode": 400,
  "message": "File type application/pdf is not allowed. Allowed types: image/jpeg, image/jpg, image/png, application/pdf, video/mp4",
  "error": "Bad Request"
}
```

**Error Response (403 Forbidden) - Unauthorized:**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Forbidden"
}
```

**Use Case:** Upload video tari, video tutorial, dll.

**Note:** URL tidak bisa diakses secara langsung (private). Perlu presigned URL untuk streaming/download.

---

### 5. Delete File

Menghapus file dari S3. Hanya untuk kurator dan admin.

**Endpoint:** `DELETE /upload/file`

**Authentication:** Required (JWT Token)
**Authorization:** `kurator_daerah`, `admin_kpoti`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://my-bucket.s3.ap-southeast-1.amazonaws.com/images/550e8400-e29b-41d4-a716-446655440000.jpg"
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | URL file yang ingin dihapus |

**Request Example:**
```javascript
fetch('/upload/file', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://my-bucket.s3.ap-southeast-1.amazonaws.com/images/550e8400-e29b-41d4-a716-446655440000.jpg'
  })
});
```

**Success Response (200 OK):**
```json
{
  "message": "File deleted successfully"
}
```

**Error Response (400 Bad Request) - No URL:**
```json
{
  "statusCode": 400,
  "message": "No URL provided",
  "error": "Bad Request"
}
```

**Error Response (400 Bad Request) - Invalid URL:**
```json
{
  "statusCode": 400,
  "message": "Invalid S3 URL",
  "error": "Bad Request"
}
```

**Error Response (403 Forbidden) - Unauthorized:**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Forbidden"
}
```

**Use Case:** Menghapus file yang tidak terpakai atau mengganti file lama dengan yang baru.

**Note:** Pastikan URL yang diberikan adalah valid S3 URL dari bucket ini.

---

## Roles & Permissions

| Endpoint | Publik | Login | Kurator | Pakar | Admin |
|----------|--------|-------|---------|-------|-------|
| POST /upload/image | ❌ | ✅ | ✅ | ✅ | ✅ |
| POST /upload/avatar | ❌ | ✅ | ✅ | ✅ | ✅ |
| POST /upload/document | ❌ | ❌ | ✅ | ✅ | ✅ |
| POST /upload/video | ❌ | ❌ | ✅ | ❌ | ✅ |
| DELETE /upload/file | ❌ | ❌ | ✅ | ❌ | ✅ |

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (no file, invalid file, file too large) |
| 403 | Forbidden (tidak memiliki permission) |
| 500 | Internal Server Error |

---

## Common Use Cases

### 1. Upload Avatar saat Register/Edit Profile

```javascript
// Step 1: Upload avatar
const formData = new FormData();
formData.append('file', avatarFile);

const uploadResponse = await fetch('/upload/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const { url } = await uploadResponse.json();

// Step 2: Update user profile dengan avatar URL
await fetch('/users/me', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    avatar_url: url
  });
});
```

### 2. Upload Multiple Images

```javascript
const uploadPromises = files.map(file => {
  const formData = new FormData();
  formData.append('file', file);

  return fetch('/upload/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
});

const responses = await Promise.all(uploadPromises);
const urls = await Promise.all(responses.map(r => r.json()));
```

### 3. Delete Old File Before Upload New

```javascript
// Delete old avatar
await fetch('/upload/file', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ url: oldAvatarUrl })
});

// Upload new avatar
const formData = new FormData();
formData.append('file', newAvatarFile);

const response = await fetch('/upload/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

---

## Notes

- File size limit: 10 MB
- Gunakan UUID untuk filename (auto-generated) untuk menghindari conflict
- Image dan Avatar URL bersifat public (bisa langsung diakses)
- Document dan Video URL bersifat private (perlu presigned URL untuk akses)
- Pastikan file dihapus dari S3 jika tidak lagi digunakan untuk menghemat storage
- Selalu validasi tipe file di frontend sebelum upload untuk better UX
