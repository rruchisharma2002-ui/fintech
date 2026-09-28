# Phase 1 — abhi tak kya ho chuka hai

Yeh user auth ka phase hai. Paisa, account, transaction abhi nahi.

Client request bhejta hai, server response deta hai. Beech ka flow:

```
CLIENT
  → ROUTE
  → MIDDLEWARE        (validation ya access token, jahan laga ho)
  → CONTROLLER        (req lo, res do)
  → SERVICE           (kaam: hash, compare, token)
  → REPOSITORY        (SQL)
  → POSTGRES
  → response wapas controller se client ko
```

Route path decide karta hai. Middleware `next()` bole tabhi aage. Controller service choose karta hai. Service ke paas `req` / `res` nahi aata. Repository `pool` se DB se baat karti hai.

Server: `npm run dev` → `tsx watch src/index.ts` → port **3000**.  
`index.ts` sirf `createApp()` karke `listen` karta hai. Routes `app.ts` pe lagte hain.

`express.json()` JSON body ko `req.body` banata hai. Bina iske name, email, password nahi milte.

Prefix: `/api/v1/user`. Path `user` hai, `users` nahi.

---

## 1. Pehle kya bana — register aur login

**Routes**

| Method | Path | Kya hota hai |
|---|---|---|
| POST | `/api/v1/user/register` | naya user |
| POST | `/api/v1/user/login` | email + password check, tokens |
| GET | `/api/v1/user/me` | current user, access token chahiye |
| GET | `/api/v1/user/protected` | token check ka test route |
| POST | `/api/v1/user/refresh` | naya access + naya refresh |
| POST | `/api/v1/user/logout` | refresh revoke, **204** |

**Register**

1. Zod body check (name min 2, email, password min 8). Galat → **400**
2. Service password hash karti hai: `bcrypt.hash(password, 12)`. `12` salt rounds hain
3. Repository `INSERT INTO users`
4. Success → **201**

Same email dubara → Postgres code **`23505`**. Service `AppError(409, "Email is already registered")` throw karti hai. Error middleware **409** bhejti hai.

**Login**

1. Zod check
2. Email se user. Nahi mila → **401** `"Invalid email or password"`
3. `bcrypt.compare(req wala password, DB wala hash)`. Match nahi → wahi **401**
4. Match → access token + refresh token + `{ id, name, email }`

`bcrypt.compare` hash ko password wapas nahi banata. Woh check karta hai: yeh plain password usi hash se bana tha ya nahi.

**`/me`**

Header: `Authorization: Bearer <accessToken>`. Body nahi.

1. `authenticate` token check, `req.user = { userId }`
2. `getCurrentUser` → `findUserById`
3. SQL sirf `id, name, email`. Password nahi
4. User nahi → **404**

**Users table** (repo ki query se; migration 001 khali hai kyunki table pehle se DB mein thi)

- `id`, `name`, `email`, `password` (hash), `created_at`, `updated_at`

DB columns snake_case hain. Query mein alias hai: `created_at AS "createdAt"`. JavaScript ko camelCase milta hai.

`$1, $2` placeholder hain. User ki value query string mein chipakti nahi, alag array mein jaati hai.

---

## 2. Secrets aur DB connection

Password aur JWT secret code mein nahi. `.env` mein:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`

`env.ts` `dotenv` se `.env` ko `process.env` pe chadhaata hai. Koi value missing → server start pe hi error: `Missing environment variable: ...`

`database.ts` inhi values se `Pool` banata hai. Pool = ready connections ka group.

`.env` badlo toh server restart. `.env` git pe nahi jaati.

Galat `DB_PASSWORD` → `password authentication failed for user "postgres"`. Yeh user ka login password nahi, **database** ka password hai. Response **500**.

---

## 3. Middleware aur Zod

Middleware route aur controller ke beech khada hota hai.

| Middleware | Kahan | Kaam |
|---|---|---|
| `validateBody` | register, login | Zod se body |
| `authenticate` | `/me`, `/protected` | access token |
| `errorMiddleware` | `app.ts` ke end pe, saari routes ke baad | `AppError` pakad ke status bhejna |

`validateBody(schema)` ek function **return** karta hai. Route pe wahi lagta hai. `safeParse` crash nahi karta: success pe `req.body = result.data` (trim, email lowercase), fail pe **400**.

`/refresh` aur `/logout` pe Zod nahi. Controller khud check karta hai: `refreshToken` string ho aur khali na ho. Nahi toh **400**.

---

## 4. Access token (JWT)

Login ke baad server ko agali request pe pata chal sake *kaun ho tum*, isliye JWT.

`src/shared/auth/jwt.ts`

- `createAccessToken({ userId })` — `jwt.sign`, secret `env.jwt.secret`, **1 hour**
- `verifyAccessToken(token)` — signature, expire, payload mein `userId` string

Token DB mein nahi rehta. Server signature se maan leta hai.

`authenticate` ab yeh karti hai:

1. Header `Bearer ` se start ho. Nahi → **401** `"Authentication required"`
2. `slice(7).trim()` se token alag (`"Bearer "` 7 characters)
3. `verifyAccessToken`
4. `req.user = { userId }`, phir `next()`
5. Galat ya expired → **401** `"Invalid or expired token"`

`req.user` Express pe default nahi hota. `src/types/express.d.ts` ne optional `user?: AuthUser` add kiya. `AuthUser` sirf `{ userId }` hai, poora user nahi.

Poora name/email `/me` pe DB se aata hai.

---

## 5. Refresh token

Access 1 ghante mein khatam. Baar baar password na maangna pade, isliye doosra token.

| | Access | Refresh |
|---|---|---|
| Kya hai | JWT | random 32 bytes, hex |
| Time | 1 hour | 7 din |
| Client kahan rakhe | header `Authorization` | body `{ "refreshToken" }` |
| DB | nahi | **sha256 hash**, raw nahi |
| Band kaise | expire ka wait | `revoked_at = NOW()` |

Raw secret client ko milta hai. DB mein hash. Same token dubara hash karo toh same hash — isi se row milti hai. DB leak ho toh raw token nahi milta.

`issueRefreshToken(userId, tokenFamilyId?)`

- naya raw token
- hash
- family id: login pe naya UUID, refresh pe **wahi** family
- expiry ab + 7 din
- repository insert
- client ko raw return

`await` zaroori hai. Andar DB call hai.

**Migrations**

- `001` — khali. Users table pehle se thi, history ka start point
- `002` — `refresh_tokens` table
- `003` — `token_family_id` UUID, NOT NULL

Columns: `id`, `user_id` (user delete → yeh rows bhi delete), `token_hash` UNIQUE, `token_family_id`, `expires_at`, `revoked_at` (null = abhi valid), `created_at`.

Script: `npm run migrate` → `node-pg-migrate`.

---

## 6. Rotation, detection, family revoke

**Rotation.** User login pe access + refresh leta hai. Access expire → `POST /refresh`.

Server purana refresh **revoke** karta hai, **naya access** deta hai, **naya refresh** deta hai, **usi family** mein. Purana refresh dubara kaam nahi karta.

```
login     A1 + R1     family F1
refresh   R1 band     A2 + R2     family F1
refresh   R2 band     A3 + R3     family F1
```

**Detection.** Koi purana, pehle se revoked refresh dubara bhejta hai. Row milti hai, `revokedAt` set hai. Matlab koi band token chala raha hai.

Message alag hai: **401** `"Refresh token reuse detected"`.

Token DB mein nahi, ya expire ho chuka → **401** `"Invalid or expired refresh token"`. Dono same message nahi.

**Family revoke.** Purana token kisi ke paas hai, toh naya bhi ho sakta hai. Isliye us `token_family_id` ke **saare** refresh tokens revoke. User ke paas jo naya refresh tha, woh bhi band. Dubara **login**. Naya login = nayi family.

```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE token_family_id = $1
  AND revoked_at IS NULL
```

**Logout.** Body mein refresh token. Server us ek token ka hash revoke karta hai. Response **204**, body khali. Token mila ya nahi, 204 hi jaata hai.

Logout ke baad wahi refresh `POST /refresh` pe reuse maana jaata hai: poori family revoke + `"Refresh token reuse detected"`.

Access token logout pe DB se nahi mit-ta. Woh 1 ghante tak header mein chal sakta hai. Naya access lene ka refresh band ho chuka hota hai.

---

## 7. Error class — constructor aur extends

`RefreshTokenReuseError extends Error`

- `class` = type
- `new` pe **constructor** chalta hai
- `super("Refresh token reuse detected")` parent `Error` ko message deta hai. `error.message` wahi ban jaata hai
- `this.name = "RefreshTokenReuseError"` taaki pata chale kaunsi class thi
- Controller `instanceof RefreshTokenReuseError` se pehchaan ke alag 401 bhejta hai
- `return null` se yeh farq nahi padta. Isliye throw

`AppError extends Error` — constructor mein `statusCode` + `message`. Duplicate email isi se **409** jaata hai. `errorMiddleware` `instanceof AppError` dekhti hai. Baaki unknown error → **500** `"Internal server error"`.

`RefreshTokenReuseError` abhi `AppError` nahi hai. Controller khud `try/catch` mein pakadta hai.

---

## 8. Types — password galat jagah na jaaye

| Type | Kya hai |
|---|---|
| `User` | DB user, password hash ke saath. Register insert aur login compare |
| `PublicUser` | id, name, email. `/me` aur login ka user |
| `LoginResponse` | `{ user, accessToken, refreshToken }` |
| `RefreshToken` | refresh_tokens ki row |
| `RefreshResponse` | `{ accessToken, refreshToken }` |
| `AuthUser` | `{ userId }` — sirf token se |

---

## 9. Folders aur language

| Jagah | Kaam |
|---|---|
| `src/index.ts` | listen |
| `src/app.ts` | express, json, routes, error middleware |
| `src/config/` | env, pool |
| `src/modules/user/` | is feature ka route, controller, service, repository, validation |
| `src/shared/auth/` | JWT aur refresh hash, ek jagah |
| `src/shared/errors/` | AppError, RefreshTokenReuseError |
| `src/middleware/` | error middleware |
| `migrations/` | SQL history |

`package.json` mein `"type": "module"` → `import` / `export`. `require` nahi.

Import path `.js` pe khatam hota hai, file `.ts` hone ke baad bhi: `import { createApp } from "./app.js"`. `tsconfig` `NodeNext` hai.

**dependencies** (server chalte time): express, pg, bcrypt, jsonwebtoken, dotenv, zod, node-pg-migrate

**devDependencies** (`npm install -D`, sirf likhte time): typescript, tsx, `@types/...`

---

## Status codes, ek nazar

| Code | Kab |
|---|---|
| 200 | login, `/me`, refresh success |
| 201 | register |
| 204 | logout, body nahi |
| 400 | body galat, refresh token missing |
| 401 | login galat, token galat/expired, refresh invalid, reuse detected |
| 404 | `/me` pe user nahi |
| 409 | email pehle se hai |
| 500 | DB down, missing env, jo error pakda nahi gaya |

---

## Jo code.md mein clearly ek jagah nahi tha

Yeh abhi code **kar raha hai**. Notes mein scatter tha, ya purani line reh gayi thi.

1. **Register ka response password hash bhi bhejta hai.** `createUser` `password` return karta hai, controller wahi `201` pe bhej deta hai. Login aur `/me` password nahi bhejte. Register ko bhi `PublicUser` hona chahiye — abhi nahi kiya.
2. **`authenticate` ab `split` nahi karti.** `slice(7).trim()` aur `verifyAccessToken`. Fail message: `"Invalid or expired token"`.
3. **Access token `jwt.ts` mein banta hai**, service ke andar seedha `jwt.sign` nahi. Login service aur refresh service dono `createAccessToken` use karti hain.
4. **Duplicate email 409** Postgres `23505` se aata hai, Zod se nahi.
5. **Migration 001 khali hai.** `users` ka `CREATE TABLE` is repo mein nahi. Table pehle se database mein thi.
6. **Logout ke baad access token ~1 hour aur chal sakta hai.** Refresh band ho jata hai, JWT turant nahi.
7. **Logout hamesha 204.** Token galat ho tab bhi. Client ko pata nahi chalta token mila ya nahi.
8. **`/refresh` aur `/logout` pe Zod nahi.** Sirf "string hai aur khali nahi".
9. **Reuse wale do error classes comment mein hain** (`RefreshTokenExpiredError`, `RefreshTokenInvalidError`). Abhi use nahi. Expire aur missing dono `"Invalid or expired refresh token"` dete hain.
10. **Tests nahi hain.** `npm test` sirf error print karke exit karta hai.
11. **Tokens cookie mein nahi**, JSON body / header mein. Frontend baad mein decide karega kahan save karna hai.

Detail, line-by-line, `code.md` mein hai. Yeh file sirf phase 1 ka short map hai.
