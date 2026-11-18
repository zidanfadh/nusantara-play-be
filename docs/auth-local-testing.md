# Self-hosted auth: manual check against the local backend (Phase 08)

A short curl sequence that walks through register → login → `GET /api/users/me` → refresh →
logout against **your local backend** and shows the cookies after every step. It never touches
production.

## Before you start

1. Database running and seeded: `npm run db:up`, `npm run db:setup`.
2. `.env.local` has a dev key pair (`npm run auth:generate-keys`, see CLAUDE.md "Local development")
   and the Phase 08 lines from `.env.local.example`, in particular:

   ```env
   AUTH_COOKIE_PATH=/api/auth
   AUTH_COOKIE_SECURE=false
   FRONTEND_URLS=http://localhost:3001
   ```

   Without `AUTH_COOKIE_PATH=/api/auth` the refresh cookie gets the production path
   `/backend-api/auth`, and curl (like a browser) will not send it to `/api/auth/refresh`
   (refresh then answers 401).

   Put it in `.env.local`, not in a Git Bash `export`: Git Bash rewrites environment values that
   look like POSIX paths for Windows programs (`/api/auth` becomes `C:/Program Files/Git/api/auth`),
   which the backend rejects and replaces with the default. If you must export it, also export
   `MSYS2_ENV_CONV_EXCL=AUTH_COOKIE_PATH`.
3. Backend running: `npm run start:dev` (http://localhost:3000/api).

## The sequence (Git Bash or any POSIX shell)

The cookie endpoints need the CSRF headers `X-Requested-With: nusantara-play` and an `Origin` from
`FRONTEND_URLS`. `jar.txt` is curl's cookie jar (Netscape format; httpOnly cookies are prefixed with
`#HttpOnly_`). Delete `jar.txt` afterwards: it holds a live refresh token.

```bash
API=http://localhost:3000/api
EMAIL="manual-$(date +%s)@example.test"
PASSWORD='a long local test password'
CSRF=(-H 'X-Requested-With: nusantara-play' -H 'Origin: http://localhost:3001')
rm -f jar.txt

# 1. Register: 201, always the same generic body, no cookies.
curl -s -i -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Manual Test\"}"

# 2. Login: 200 { accessToken, expiresIn, user } and two Set-Cookie headers:
#    np_refresh (HttpOnly; Path=/api/auth; SameSite=Lax) and np_logged_in=1 (Path=/).
curl -s -i -c jar.txt -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | tee login.txt
cat jar.txt
ACCESS=$(grep -o '"accessToken":"[^"]*"' login.txt | cut -d'"' -f4)

# 3. The access token works on a protected endpoint.
curl -s "$API/users/me" -H "Authorization: Bearer $ACCESS"; echo

# 4. Refresh: 200, a NEW np_refresh value in the jar (rotation).
curl -s -i -b jar.txt -c jar.txt -X POST "$API/auth/refresh" "${CSRF[@]}"
cat jar.txt

# 4b. Without the CSRF headers: 403, the cookie is untouched.
curl -s -o /dev/null -w '%{http_code}\n' -b jar.txt -X POST "$API/auth/refresh"

# 5. Logout: 204, both cookies cleared (Set-Cookie with an Expires date in 1970);
#    the jar no longer contains them.
curl -s -i -b jar.txt -c jar.txt -X POST "$API/auth/logout" "${CSRF[@]}"
cat jar.txt

# 6. Refresh after logout: 401 {"error":"invalid_refresh_token", ...}.
curl -s -b jar.txt -X POST "$API/auth/refresh" "${CSRF[@]}"; echo

rm -f jar.txt login.txt
```

## What you should see

| Step | Status | Cookies |
|------|--------|---------|
| 1 register | 201 `{"success":true,"message":"Registration received. ..."}` | none |
| 2 login | 200, body with `accessToken`, `expiresIn` (900), `user` | `np_refresh` (HttpOnly, Path=/api/auth, SameSite=Lax, Max-Age=2592000), `np_logged_in=1` (Path=/) |
| 3 /users/me | 200, the same user object as in the login body | — |
| 4 refresh | 200, new `accessToken` | `np_refresh` replaced by a new value |
| 4b refresh without CSRF headers | 403 | unchanged |
| 5 logout | 204 | both cleared |
| 6 refresh | 401 `invalid_refresh_token` | both cleared again |

Other things worth trying: registering the same email again returns exactly the same 201 body;
5 wrong passwords lock the account for 15 minutes (`LOGIN_LOCK_MINUTES`), after which even the
right password gets the generic 401 until the lock expires; the 11th login attempt for one email
within 15 minutes returns 429.

Clean up the test users afterwards if you like (local dev database only):

```bash
docker exec nusantara-dev-db psql -U postgres -d nusantara_play_dev \
  -c "DELETE FROM users WHERE email LIKE 'manual-%@example.test';"
```

---

# Email verification and password reset with Mailpit (Phase 09)

In development every email goes to **Mailpit**, a local mail catcher (`axllent/mailpit`, started by
`npm run db:up` together with PostgreSQL). Nothing reaches a real mailbox. Tests never use Mailpit:
they replace the email sender with a capturing double (`test/capturing-email.ts`).

## Before you start

1. `npm run db:up` starts both containers: `nusantara-dev-db` and `nusantara-dev-mailpit`
   (SMTP on `127.0.0.1:1025`, web UI on http://localhost:8025, both bound to loopback only).
2. `.env.local` needs the Phase 09 lines from `.env.local.example`:

   ```env
   SMTP_HOST=127.0.0.1
   SMTP_PORT=1025
   SMTP_SECURE=false
   SMTP_USER=
   SMTP_PASS=
   SMTP_FROM="Nusantara Play (local) <no-reply@example.test>"
   APP_PUBLIC_URL=http://localhost:3001
   EMAIL_VERIFICATION_TTL_HOURS=24
   PASSWORD_RESET_TTL_MINUTES=60
   ```

   Without `APP_PUBLIC_URL` the verification and reset emails are not sent (one warning per attempt,
   without the address).
3. Run the migration if your dev database was set up before Phase 09: `npm run migration:run`
   (or `npm run db:setup`, which builds the tables from the entities).
4. `npm run start:dev`.

## The sequence

Open http://localhost:8025 next to the terminal. The email work runs in the background after the
response, so an email appears in Mailpit about a second after the request.

```bash
API=http://localhost:3000/api
EMAIL="manual-$(date +%s)@example.test"
PASSWORD='a long local test password'
NEW_PASSWORD='another long local password'

# 1. Register: 201 with the usual generic body. Mailpit shows
#    "Verifikasi email akun Nusantara Play Anda" with a link
#    http://localhost:3001/verify-email?token=...
curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Manual Test\"}"; echo

# 2. Log in (allowed before verifying) and look at emailVerified (false).
ACCESS=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
curl -s "$API/users/me" -H "Authorization: Bearer $ACCESS" | grep -o '"emailVerified":[a-z]*'

# 3. Copy the token from the link in Mailpit (everything after "token=").
VERIFY_TOKEN='paste-the-token-here'
curl -s -X POST "$API/auth/verify-email" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$VERIFY_TOKEN\"}"; echo          # 200 {"success":true,...}
curl -s "$API/users/me" -H "Authorization: Bearer $ACCESS" | grep -o '"emailVerified":[a-z]*'   # true
curl -s -X POST "$API/auth/verify-email" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$VERIFY_TOKEN\"}"; echo          # 400 code invalid_or_expired_token (single use)

# 4. Forgot password: always 200 with the same body, also for an unknown address.
#    Mailpit shows "Atur ulang password Nusantara Play" with
#    http://localhost:3001/reset-password?token=...
curl -s -X POST "$API/auth/forgot-password" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}"; echo

# 5. Reset with the token from that email (wait > 5 s after step 2 to see step 6c fail:
#    access tokens issued up to 5 s before a password change are still accepted).
RESET_TOKEN='paste-the-token-here'
curl -s -X POST "$API/auth/reset-password" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"$NEW_PASSWORD\"}"; echo   # 200
#    Mailpit now also shows "Password Nusantara Play Anda telah diubah".

# 6. a) old password 401, b) new password 200, c) the access token from step 2 is rejected (401).
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASSWORD\"}"
curl -s -o /dev/null -w '%{http_code}\n' "$API/users/me" -H "Authorization: Bearer $ACCESS"
```

## What you should see

| Step | Result | Mailpit |
|------|--------|---------|
| 1 register | 201 generic body | "Verifikasi email akun Nusantara Play Anda" |
| 2 /users/me | `"emailVerified":false` | — |
| 3 verify-email | 200, then `"emailVerified":true`; second use 400 `invalid_or_expired_token` | — |
| 4 forgot-password | 200 generic body (same for unknown addresses) | "Atur ulang password Nusantara Play" (nothing for unknown addresses) |
| 5 reset-password | 200 | "Password Nusantara Play Anda telah diubah" |
| 6 | old password 401, new password 200, old access token 401 | — |

Also worth trying: registering the same address again sends "Akun Nusantara Play Anda sudah ada" (the
HTTP answer is unchanged); a 4th forgot-password for one address within an hour still answers 200 but
sends no email (3 per address per hour); `POST /auth/resend-verification` sends a new link only while
the address is unverified, and every new link invalidates the previous unused one.

Mailpit keeps the messages until the container is removed (no volume). Delete them in its UI
("Delete all") or with `curl -X DELETE http://localhost:8025/api/v1/messages`.
