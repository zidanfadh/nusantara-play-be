# Sync User Data from Supabase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fetch complete user data from Supabase API during login and sync to local database.

**Architecture:**
- Create SupabaseService to handle API communication
- Update JwtStrategy to fetch user data on each login
- Add upsert method in UsersService for sync
- Graceful fallback if Supabase API fails

**Tech Stack:**
- `@supabase/supabase-js` - Official Supabase client
- NestJS - Existing framework
- TypeORM/PostgreSQL - Existing database

---

### Task 1: Install Supabase Client Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install @supabase/supabase-js**

Run: `npm install @supabase/supabase-js`

Expected output:
```
added 1 package, and audited XXX packages in Xs
```

**Step 2: Verify installation**

Run: `npm list @supabase/supabase-js`

Expected: `@supabase/supabase-js@2.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @supabase/supabase-js dependency"
```

---

### Task 2: Create SupabaseService

**Files:**
- Create: `src/modules/supabase/supabase.service.ts`
- Create: `src/modules/supabase/supabase.module.ts`
- Create: `src/modules/supabase/index.ts`

**Step 1: Create SupabaseService**

Create `src/modules/supabase/supabase.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseUser {
  id: string;
  email: string;
  phone: string | null;
  user_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  full_name?: string;
  name?: string;
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseServiceKey = this.configService.get<string>(
      'supabase.serviceRoleKey',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }

    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async fetchUserById(userId: string): Promise<SupabaseUser> {
    const { data, error } = await this.adminClient.auth.admin.getUserById(userId);

    if (error) {
      this.logger.error(`Failed to fetch user from Supabase: ${error.message}`);
      throw new Error(`Supabase API error: ${error.message}`);
    }

    if (!data.user) {
      throw new Error(`User not found in Supabase: ${userId}`);
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
      phone: data.user.phone,
      user_metadata: data.user.user_metadata,
      created_at: data.user.created_at,
      updated_at: data.user.updated_at,
      avatar_url: data.user.user_metadata?.avatar_url,
      full_name: data.user.user_metadata?.full_name,
      name: data.user.user_metadata?.name,
    };
  }
}
```

**Step 2: Create SupabaseModule**

Create `src/modules/supabase/supabase.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

**Step 3: Create barrel export**

Create `src/modules/supabase/index.ts`:

```typescript
export * from './supabase.module';
export * from './supabase.service';
```

**Step 4: Commit**

```bash
git add src/modules/supabase/
git commit -m "feat: add SupabaseService for fetching user data"
```

---

### Task 3: Register SupabaseModule in AppModule

**Files:**
- Modify: `src/app.module.ts`

**Step 1: Import SupabaseModule in AppModule**

Read `src/app.module.ts` and add SupabaseModule to imports:

```typescript
import { SupabaseModule } from './modules/supabase';

@Module({
  imports: [
    // ... existing imports
    SupabaseModule,
  ],
  // ... rest of the module
})
export class AppModule {}
```

**Step 2: Verify build passes**

Run: `npm run build`

Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: register SupabaseModule in AppModule"
```

---

### Task 4: Update UsersService with syncFromSupabase Method

**Files:**
- Modify: `src/modules/users/users.service.ts`

**Step 1: Add syncFromSupabase method to UsersService**

Read `src/modules/users/users.service.ts` and add this method after the `createFromSupabase` method:

```typescript
async syncFromSupabase(supabaseUser: any): Promise<User> {
  // Determine full_name with fallbacks
  const fullName =
    supabaseUser.full_name ||
    supabaseUser.name ||
    supabaseUser.user_metadata?.full_name ||
    supabaseUser.user_metadata?.name ||
    supabaseUser.email?.split('@')[0] ||
    '';

  // Map Supabase user to CreateUserDto
  const userData: CreateUserDto = {
    supabase_user_id: supabaseUser.id,
    email: supabaseUser.email,
    full_name: fullName,
    phone: supabaseUser.phone || undefined,
    avatar_url: supabaseUser.avatar_url || supabaseUser.user_metadata?.avatar_url,
  };

  // Check if user exists
  const existingUser = await this.findBySupabaseId(supabaseUser.id);

  if (existingUser) {
    // Update existing user
    return this.update(existingUser.id, userData);
  } else {
    // Create new user
    return this.createFromSupabase(userData);
  }
}
```

**Step 2: Verify build passes**

Run: `npm run build`

Expected: Build succeeds (User entity may need `update` method, if missing add it)

**Step 3: Commit**

```bash
git add src/modules/users/users.service.ts
git commit -m "feat: add syncFromSupabase method to UsersService"
```

---

### Task 5: Update JwtStrategy to Fetch from Supabase

**Files:**
- Modify: `src/modules/auth/strategies/jwt.strategy.ts`

**Step 1: Inject SupabaseService and update validate method**

Replace the entire `validate` method in `jwt.strategy.ts`:

```typescript
import { SupabaseService } from '../../supabase';

// In constructor, add:
constructor(
  private configService: ConfigService,
  private usersService: UsersService,
  private supabaseService: SupabaseService,
) {
  // ... existing constructor code
}

// Replace the validate method:
async validate(payload: JwtPayload) {
  const supabaseUserId = payload.sub;

  let user = await this.usersService.findBySupabaseId(supabaseUserId);

  try {
    // Fetch complete user data from Supabase
    const supabaseUser = await this.supabaseService.fetchUserById(supabaseUserId);
    user = await this.usersService.syncFromSupabase(supabaseUser);
  } catch (error) {
    // Fallback: use existing local data or create minimal user
    if (!user) {
      user = await this.usersService.createFromSupabase({
        supabase_user_id: supabaseUserId,
        email: payload.email,
        full_name: payload.email.split('@')[0],
      });
    }
    // Log error but don't block login
    console.error('Failed to sync user from Supabase, using local data:', error.message);
  }

  await this.usersService.updateLastLogin(user.id);
  return user;
}
```

**Step 2: Update AuthModule imports**

Read `src/modules/auth/auth.module.ts` and ensure SupabaseModule is imported:

```typescript
import { SupabaseModule } from '../supabase';

@Module({
  imports: [
    // ... existing imports
    SupabaseModule,
  ],
  // ... rest of the module
})
export class AuthModule {}
```

**Step 3: Verify build passes**

Run: `npm run build`

Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/modules/auth/strategies/jwt.strategy.ts src/modules/auth/auth.module.ts
git commit -m "feat: sync user data from Supabase on login"
```

---

### Task 6: Add Environment Variable Documentation

**Files:**
- Create: `.env.example` (if not exists) or Modify existing

**Step 1: Add SUPABASE_SERVICE_ROLE_KEY to .env.example**

Read `.env.example` and add:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add SUPABASE_SERVICE_ROLE_KEY to environment variables"
```

---

### Task 7: Manual Testing

**Step 1: Set environment variable**

Add to your `.env` file:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
```

Get the key from: Supabase Dashboard → Project Settings → API → service_role (secret)

**Step 2: Start the application**

Run: `npm run start:dev`

Expected: Server starts without errors

**Step 3: Test login flow**

1. Login with a Supabase user (via your auth endpoint)
2. Check the user is created/updated in local database
3. Verify `avatar_url` is populated if exists in Supabase

Run: `SELECT * FROM users WHERE email = 'test@example.com';`

Expected: User record with populated fields

---

## Completion Checklist

- [ ] `@supabase/supabase-js` installed
- [ ] SupabaseService created and functional
- [ ] SupabaseModule registered in AppModule
- [ ] UsersService.syncFromSupabase() method added
- [ ] JwtStrategy updated to fetch from Supabase
- [ ] Environment variable documented
- [ ] Manual testing completed
- [ ] Build passes
