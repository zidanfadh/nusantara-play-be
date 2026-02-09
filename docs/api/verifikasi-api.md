# PROT Verification System API Documentation

## Overview

The PROT Verification System implements a 4-stage workflow for managing PROT (Permainan Rakyat dan Olahraga Tradisional) entries through a review process before publication.

## Status Flow

```
[DRAFT] ──submit──▶ [DIKURASI] ──pick & review──┐
  ▲                                              │
  │                          ┌───────────────────┤
  │                          ▼                   ▼
  │                     [REJECTED]      [REVISION_NEEDED]
  │                     (→ DRAFT)              │
  │                                            ▼
  │                                        [REVISI]
  │                                            │
  │                                       re-submit
  │                                            │
  │                                            ▼
  │                                        [DIKURASI]
  │
  │      APPROVED
  │         │
  │         ▼
  │  [DIVERIFIKASI] ──publish──▶ [ARSIP_NASIONAL]
  │
  └──── (rejected kembali ke draft)
```

## Status Meanings

| Status | Description | Who Can Transition |
|--------|-------------|-------------------|
| `DRAFT` | Kurator is working on the PROT | Kurator (submit), Admin |
| `DIKURASI` | Submitted by kurator, in verification queue | Pakar (pick & review) |
| `REVISI` | Pakar requested revisions | Kurator (resubmit) |
| `DIVERIFIKASI` | Approved by pakar, awaiting publish | Admin (publish) |
| `ARSIP_NASIONAL` | Published and visible to public | - (final state) |
| `REJECTED` | Rejected by pakar, returns to DRAFT | - (transient) |

## Role-Based Access Control

### Public (PUBLIK)
- Can only view PROT with status `ARSIP_NASIONAL`

### Kurator Daerah (KURATOR_DAERAH)
- Create PROT (default: `DRAFT` status)
- Edit own PROT (only `DRAFT` or `REVISI` status)
- Submit PROT for verification (`DRAFT` → `DIKURASI`)
- Resubmit after revision (`REVISI` → `DIKURASI`)
- View own PROT + published PROT (`ARSIP_NASIONAL`)

### Pakar (PAKAR)
- View available verification queue (`DIKURASI` status)
- Pick PROT from queue (assign to self)
- Release assigned PROT back to queue
- Submit review: APPROVE, REJECT, or REVISION_NEEDED
- View verification history
- View `DIKURASI` + `ARSIP_NASIONAL` PROT

### Admin KPOTI (ADMIN_KPOTI)
- All Kurator permissions
- Publish PROT (`DIVERIFIKASI` → `ARSIP_NASIONAL`)
- View all PROT regardless of status
- View verification statistics

## API Endpoints

### Kurator Endpoints

#### Submit PROT for Verification
```http
POST /api/prot/:id/submit-kurasi
Authorization: Bearer <token>
Content-Type: application/json

{
  "catatan": "Optional notes from kurator"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "DIKURASI",
  "submitted_at": "2024-02-09T10:00:00.000Z",
  ...
}
```

**Error Responses:**
- `403` - Not the owner of this PROT
- `400` - PROT is not in DRAFT status
- `404` - PROT not found

#### Resubmit After Revision
```http
POST /api/prot/:id/resubmit
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "DIKURASI",
  "submitted_at": "2024-02-09T11:00:00.000Z",
  ...
}
```

**Error Responses:**
- `403` - Not the owner of this PROT
- `400` - PROT is not in REVISI status
- `404` - PROT not found

### Pakar Endpoints

#### Get Available Queue
```http
GET /api/verifikasi/queue?page=1&limit=20
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "queue-uuid",
      "prot": {
        "id": "prot-uuid",
        "nama": "Gasing",
        "status": "DIKURASI",
        "createdBy": {
          "id": "user-uuid",
          "full_name": "Kurator Name"
        },
        ...
      },
      "priority": 0,
      "created_at": "2024-02-09T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Get My Queue (Assigned to Me)
```http
GET /api/verifikasi/my-queue?page=1&limit=20
Authorization: Bearer <token>
```

**Response:** `200 OK` (same structure as above)

#### Pick PROT from Queue
```http
POST /api/verifikasi/queue/:queueId/pick
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "queue-uuid",
  "assigned_pakar_id": "pakar-uuid",
  "assigned_at": "2024-02-09T10:30:00.000Z",
  ...
}
```

**Error Responses:**
- `404` - Queue item not found
- `400` - Already assigned to another pakar or PROT not in DIKURASI status

#### Release Assigned PROT
```http
POST /api/verifikasi/queue/:queueId/release
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "queue-uuid",
  "assigned_pakar_id": null,
  "assigned_at": null,
  ...
}
```

**Error Responses:**
- `404` - Queue item not found or not assigned to you

#### Submit Review
```http
POST /api/verifikasi/:protId/review
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "APPROVED",
  "catatan": "Optional review notes",
  "saran_perbaikan": "Required if REVISION_NEEDED",
  "dokumen_pendukung": ["https://s3.amazonaws.com/bucket/file.pdf"]
}
```

**Status Options:**
- `APPROVED` - Moves PROT to DIVERIFIKASI
- `REJECTED` - Moves PROT back to DRAFT
- `REVISION_NEEDED` - Moves PROT to REVISI (requires saran_perbaikan)

**Response:** `201 Created`
```json
{
  "id": "verifikasi-uuid",
  "prot_id": "prot-uuid",
  "pakar_id": "pakar-uuid",
  "status": "APPROVED",
  "catatan": "Good documentation",
  "verified_at": "2024-02-09T11:00:00.000Z",
  "created_at": "2024-02-09T11:00:00.000Z"
}
```

**Error Responses:**
- `403` - PROT not assigned to you or not in queue
- `400` - Invalid status transition or missing required fields

#### Get Verification History
```http
GET /api/verifikasi/:protId/history
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": "verifikasi-uuid",
    "status": "REVISION_NEEDED",
    "catatan": "Please add more details",
    "saran_perbaikan": "Add historical context",
    "pakar": {
      "id": "pakar-uuid",
      "full_name": "Pakar Name"
    },
    "verified_at": "2024-02-09T10:00:00.000Z",
    "created_at": "2024-02-09T10:00:00.000Z"
  }
]
```

### Admin Endpoints

#### Publish PROT to National Archive
```http
POST /api/verifikasi/prot/:protId/publish
Authorization: Bearer <token>
Content-Type: application/json

{
  "catatan": "Optional admin notes"
}
```

**Response:** `200 OK`
```json
{
  "id": "prot-uuid",
  "status": "ARSIP_NASIONAL",
  "published_by": "admin-uuid",
  "published_at": "2024-02-09T12:00:00.000Z",
  ...
}
```

**Error Responses:**
- `400` - PROT is not in DIVERIFIKASI status
- `404` - PROT not found

#### Get Verification Statistics
```http
GET /api/verifikasi/stats
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "queue": {
    "totalPending": 15
  },
  "verifikasi": {
    "totalApproved": 120,
    "totalRejected": 8,
    "totalRevision": 22,
    "total": 150
  },
  "protByStatus": {
    "DRAFT": 25,
    "DIKURASI": 15,
    "REVISI": 12,
    "DIVERIFIKASI": 18,
    "ARSIP_NASIONAL": 120
  }
}
```

## Updated Query Filters

The PROT list endpoint now supports additional filters:

```http
GET /api/prot?status=DIKURASI&created_by=user-uuid
```

**New Parameters:**
- `status` - Filter by PROT status (enum)
- `created_by` - Filter by creator UUID

## Error Response Format

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message description",
  "error": "Bad Request"
}
```

## Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Validation failed or invalid state transition |
| 403 | Forbidden - Insufficient permissions or not owner |
| 404 | Not Found - Resource doesn't exist |
| 401 | Unauthorized - Missing or invalid token |

## Audit Trail

All mutations (create, update, submit, review, publish) are logged via AuditInterceptor with:
- User ID who performed the action
- Action timestamp
- Request details
