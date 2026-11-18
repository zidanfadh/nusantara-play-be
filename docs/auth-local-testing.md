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
