# Events Feature Design Document

**Date:** 2026-02-11
**Status:** Design Approved
**Related Phase:** Phase 2 (Partial - Events only)

## Overview

The Events module enables management and discovery of cultural events on the Nusantara Play platform. This includes Teras Bermain (play sessions), Workshops (learning sessions), and Festivals (large cultural events).

## Architecture

### Module Structure

```
src/modules/events/
├── entities/
│   ├── event.entity.ts
│   └── event-registration.entity.ts
├── dto/
│   ├── create-event.dto.ts
│   ├── update-event.dto.ts
│   ├── event-filter.dto.ts
│   ├── event.dto.ts
│   ├── register-event.dto.ts
│   └── event-registration.dto.ts
├── events.module.ts
├── events.controller.ts
├── events.service.ts
├── event-registrations.service.ts
└── events.scheduler.ts
```

### Dependencies

- **AuthModule** - JWT authentication via Supabase
- **UsersModule** - User management and references
- **DaerahModule** - Regional location data
- **StorageModule** - Event banner and image uploads
- **AuditModule** - Automatic change logging
- **NotificationsModule** - Event-related notifications
- **ScheduleModule** - Cron jobs for status updates

## Data Model

### Event Entity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | string | Event name |
| description | text | Full event description |
| type | enum | teras_bermain, workshop, festival |
| status | enum | draft, published, ongoing, completed, cancelled |
| startDate | timestamp | Event start (triggers ongoing) |
| endDate | timestamp | Event end (triggers completed) |
| registrationDeadline | timestamp | Last date to register |
| locationType | enum | online, offline, hybrid |
| location | string | Physical address or venue |
| onlineUrl | string | URL for online events |
| bannerImage | string | S3 URL to banner |
| additionalImages | string[] | Array of S3 URLs |
| daerahId | UUID (FK) | Regional location |
| organizerId | UUID (FK) | Creator user |
| maxParticipants | int (nullable) | Optional capacity |
| isFeatured | boolean | Featured flag |
| tags | string[] | Searchable tags |
| schedule | jsonb | Agenda/sessions array |
| speakers | jsonb | Instructor/speaker info |
| requirements | text | Prerequisites for attendees |
| contactInfo | jsonb | Contact details |
| socialLinks | jsonb | Social media URLs |
| createdAt / updatedAt | timestamp | Auto-managed |

### EventRegistration Entity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| eventId | UUID (FK) | Event reference |
| userId | UUID (FK) | Attendee |
| status | enum | registered, checked_in, cancelled |
| checkedInAt | timestamp | Check-in timestamp |
| checkedInBy | UUID (FK) | User who performed check-in |
| createdAt | timestamp | Registration time |

## Event Types

All event types share the same data structure. The `type` field is for categorization and filtering only:

1. **teras_bermain** - Casual community play sessions
2. **workshop** - Structured learning sessions about traditional games
3. **festival** - Large-scale cultural events

## API Endpoints

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/events | List published/ongoing events |
| GET | /api/events/:id | Get published event by ID |
| GET | /api/events/featured | Get featured events |

### Authenticated Endpoints (All Users)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/events/my-registrations | Get user's event registrations |
| POST | /api/events/:id/register | Register for an event |
| DELETE | /api/events/:id/register | Cancel registration |

### Kurator & Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/events | Create new event (draft) |
| GET | /api/events/my-events | Get events created by user |
| GET | /api/events/:id | Get any event (including draft) |
| PATCH | /api/events/:id | Update event |
| DELETE | /api/events/:id | Delete event |
| PATCH | /api/events/:id/publish | Change status to published |
| PATCH | /api/events/:id/cancel | Cancel an event |
| GET | /api/events/:id/registrations | Get event registrations |
| PATCH | /api/events/:id/registrations/:userId/check-in | Check-in attendee |
| PATCH | /api/events/:id/registrations/:userId/undo-check-in | Undo check-in |

### Admin Only

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | /api/events/:id/feature | Toggle featured flag |

### Query Parameters

- `type` - Filter by event type
- `daerahId` - Filter by region
- `startDate` / `endDate` - Date range filter
- `status` - Filter by status (default: published,ongoing)
- `search` - Text search in title/description
- `sortBy` - date, popularity, createdAt
- `sortOrder` - ASC, DESC
- `page` / `limit` - Pagination

## Business Logic

### Event Status Workflow

1. **draft** → **published** (manual by creator)
2. **published** → **ongoing** (auto when `now >= startDate`)
3. **ongoing** → **completed** (auto when `now >= endDate`)
4. Any status → **cancelled** (manual by creator/admin)

### Visibility Rules

| Status | Visible To |
|--------|------------|
| draft | Creator only |
| published | Public |
| ongoing | Public |
| completed | Public |
| cancelled | Public |

### Permissions

| Role | Can Create | Can Edit | Can Delete | Can View Draft |
|------|-----------|----------|------------|---------------|
| admin_kpoti | Yes | Any | Any | Yes |
| kurator_daerah | Yes (in region) | Own events | Own events | Own only |
| pakar | No | No | No | No |
| publik | No | No | No | No |

### Registration Rules

- Only published/ongoing events can be registered
- Cannot register after `registrationDeadline`
- Unique constraint on (eventId, userId) prevents duplicates
- Registration can be cancelled by user

### Check-in Flow

1. Organizer opens event registrations list
2. Organizer scans QR code (user ID) or selects attendee
3. Organizer clicks "Check-in"
4. Status changes to `checked_in`, timestamp recorded
5. Undo available if mistake made

### Certificate Issuance

- Manual issuance only (no automation)
- Organizer can issue to any checked-in attendee
- Creates record in `certificates` table

### Notifications

- User registers → "You're registered!"
- Event changes → Notify all registered users
- Event cancelled → Notify all registered users
- 24h before event → Reminder notification

## Error Handling

| Scenario | Error Code | HTTP Status |
|----------|------------|-------------|
| Event not found | EVENT_NOT_FOUND | 404 |
| Draft event accessed by non-creator | FORBIDDEN | 403 |
| Registration past deadline | REGISTRATION_CLOSED | 400 |
| Duplicate registration | ALREADY_REGISTERED | 409 |
| Event already started | EVENT_ALREADY_STARTED | 400 |
| Check-in non-existent registration | REGISTRATION_NOT_FOUND | 404 |
| Unauthorized event management | NOT_EVENT_ORGANIZER | 403 |
| Invalid date range | INVALID_DATE_RANGE | 400 |

## Validation Rules

- `endDate` must be after `startDate`
- `registrationDeadline` must be before `startDate`
- If `locationType == offline`: `location` required
- If `locationType == online`: `onlineUrl` required
- If `locationType == hybrid`: both required

## Scheduler

A cron job runs every 5 minutes to:
- Update event statuses based on dates
- Send reminder notifications (24h before events)
- Mark completed events

## Testing Strategy

### Unit Tests
- EventsService CRUD operations
- Status transitions
- Permission checks
- DTO validation

### Integration Tests
- Registration flow with notifications
- Check-in/certificate flow
- Permission-based access
- Visibility rules

### E2E Tests
- Full lifecycle: create → publish → register → check-in → complete
- Event cancellation flow
- Date-based status transitions

## Implementation Order

1. Entities + TypeORM configuration
2. DTOs + validation
3. Service layer (business logic)
4. Controller + routes
5. Scheduler service
6. Integration with notifications
7. Tests
