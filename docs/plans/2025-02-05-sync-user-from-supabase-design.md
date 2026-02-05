# Sync User Data from Supabase API

## Problem

User data from Supabase (especially `avatar_url`) is not being synced to the local database when users log in. The JWT payload from Supabase doesn't include `avatar_url` or other profile fields - only basic info like `sub`, `email`, and `role`.

## Solution

Fetch complete user data from Supabase API during login and sync it to the local database.

## Architecture

### Components

**1. SupabaseService (New)**
- Handles all communication with Supabase
- Uses `@supabase/supabase-js` client with service_role key (admin access)
- Method: `fetchUserById(userId: string): Promise<SupabaseUser>`

**2. JwtStrategy Update**
- Update `validate()` method to fetch user data from Supabase after JWT validation
- Pass Supabase user data to `UsersService.syncFromSupabase()`

**3. UsersService Update**
- New method: `syncFromSupabase(supabaseUser: SupabaseUser)`
- Upsert pattern: create if not exists, update if exists
- Map Supabase fields to local entity

## Data Flow

```
User Login
    ↓
JWT Validated
    ↓
Check Local DB
    ↓
Fetch from Supabase API
    ↓
Sync to Local DB (upsert)
    ↓
Update Last Login
    ↓
Return User
```

## Field Mapping

| Supabase Field | Local Field | Fallback |
|---------------|-------------|----------|
| `id` | `supabase_user_id` | - |
| `email` | `email` | - |
| `phone` | `phone` | undefined |
| `user_metadata.full_name` | `full_name` | `user_metadata.name` → email prefix |
| `user_metadata.avatar_url` | `avatar_url` | undefined |

## Error Handling

**Strategy:** Never block login due to Supabase API failures.

1. Try to fetch from Supabase
2. If successful → sync to local DB
3. If failed → use local data
4. If first login and failed → create minimal user from JWT payload
5. Log error for monitoring

```typescript
try {
  const supabaseUser = await this.supabaseService.fetchUserById(userId);
  user = await this.usersService.syncFromSupabase(supabaseUser);
} catch (error) {
  if (!user) {
    user = await this.usersService.createFromSupabase(minimalData);
  }
  console.error('Failed to sync from Supabase, using local data', error);
}
```

## Environment Variables Required

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Dependencies to Install

```bash
npm install @supabase/supabase-js
```
