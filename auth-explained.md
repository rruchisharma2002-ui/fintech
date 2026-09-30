# Auth + User — Poora Flow Asaan Bhasha Mein

---

## 0. Sabse pehle — Auth hota kya hai?

Do alag cheezein hain, aur interview mein inka farq zaroor poochha jaata hai:

| Term | Sawaal | Is project mein |
|---|---|---|
| **Authentication (AuthN)** | *Tum kaun ho?* | Login (email + password), phir JWT se har request pe pehchaan |
| **Authorization (AuthZ)** | *Tumhe yeh karne ki permission hai?* | Abhi basic: `authenticate` middleware laga hai toh sirf logged-in user aage jaata hai |

> 💡 **Yaad rakho:** Pehle AuthN hota hai (kaun ho), phir AuthZ (kya kar sakte ho).
> 401 = "pehchaan nahi hui" (AuthN fail). 403 = "pehchaan hui, par permission nahi" (AuthZ fail).

Is project ka auth **3 cheezon** pe khada hai:

1. **Password** → `bcrypt` se hash hoke DB mein
2. **Access token** → JWT, 1 ghanta, har protected request pe header mein
3. **Refresh token** → random string, 7 din, naya access token lene ke liye. DB mein sirf uska **sha256 hash**

---

## 1. Folder map — kaunsi file kya karti hai

```
src/
├── index.ts                      → server START (port 3000)
├── app.ts                        → express app banao, json parser, routes, error middleware
├── config/
│   ├── env.ts                    → .env padho, missing ho toh crash
│   └── database.ts               → Postgres ka Pool (connections)
├── middleware/
│   └── error.middleware.ts       → sab errors ka last stop
├── modules/user/
│   ├── user.routes.ts            → URL → middleware → controller
│   ├── user.validation.ts        → Zod schemas (register, login)
│   ├── user.validation.middleware.ts → validateBody(schema)
│   ├── user.middleware.ts        → authenticate (JWT check)
│   ├── user.controller.ts        → req se data lo, service bulao(kam krao), res bhejo
│   ├── user.service.ts           → register/login/me ka logic (bcrypt, tokens)
│   ├── user.repositry.ts         → users table ki SQL
│   ├── refresh-token.service.ts  → refresh token issue / rotate / revoke logic
│   ├── refresh-token.repository.ts → refresh_tokens table ki SQL
│   ├── user.types.ts             → User, PublicUser, LoginResponse
│   ├── refresh-token.types.ts    → RefreshToken, RefreshResponse
│   └── user.auth.types.ts        → AuthUser { userId }
├── shared/
│   ├── auth/
│   │   ├── jwt.ts                → createAccessToken / verifyAccessToken
│   │   ├── jwt.types.ts          → AccessTokenPayload
│   │   └── refresh-token.ts      → generateRefreshToken / hashRefreshToken
│   └── errors/
│       ├── app.error.ts          → AppError (statusCode + message)
│       └── auth.errors.ts        → RefreshTokenReuseError
└── types/
    └── express.d.ts              → req.user ko TypeScript mein add karna

migrations/
├── 001_baseline_users.sql        → khali (users table pehle se DB mein thi)
├── 002_create_refresh_tokens.sql → refresh_tokens table
└── 003_add_token_family_id.sql   → token_family_id column
```

### Har layer ka ek line ka kaam

| Layer | Kaam | `req`/`res` dikhta hai? | DB se baat? |
|---|---|---|---|
| **Route** | Kaunsa URL, kaunsa method, kaunse function | haan | nahi |
| **Middleware** | Controller se pehle check (body sahi? token sahi?) | haan | nahi |
| **Controller** | HTTP ka kaam: body padho, status code bhejo | haan | nahi |
| **Service** | Business logic: hash, compare, token banana | **nahi** | repository ke through |
| **Repository** | Sirf SQL | nahi | **haan** |

> ⭐ **Important:** Service ko `req`/`res` nahi milta. Isse service **HTTP se independent** rehti hai — kal CLI ya queue se bhi call ho sakti hai, aur test karna asaan hai. Isko **Separation of Concerns** kehte hain.

---

## 2. Files aapas mein kaise jude hain (import graph)

```
index.ts
  └─ app.ts
       ├─ user.routes.ts
       │    ├─ user.validation.ts            (registerSchema, loginSchema)
       │    ├─ user.validation.middleware.ts (validateBody)
       │    ├─ user.middleware.ts            (authenticate)
       │    │     └─ shared/auth/jwt.ts      (verifyAccessToken)
       │    └─ user.controller.ts
       │          ├─ user.service.ts
       │          │    ├─ user.repositry.ts ──────────┐
       │          │    ├─ bcrypt                      │
       │          │    ├─ shared/auth/jwt.ts          │
       │          │    ├─ shared/errors/app.error.ts  │
       │          │    └─ refresh-token.service.ts    │
       │          ├─ refresh-token.service.ts         │
       │          │    ├─ shared/auth/refresh-token.ts│
       │          │    ├─ shared/auth/jwt.ts          │
       │          │    ├─ refresh-token.repository.ts ┤
       │          │    └─ shared/errors/auth.errors.ts│
       │          └─ shared/errors/auth.errors.ts     │
       └─ middleware/error.middleware.ts              │
                                                      ▼
                                          config/database.ts (pool)
                                                      │
                                                config/env.ts (.env)
```

> 💡 Dhyaan do: **`jwt.ts` do jagah se use hota hai** — service token *banati* hai, middleware token *verify* karti hai. Dono ek hi file se, isliye secret aur expiry ek hi jagah defined hai.

---

## 3. Server kaise start hota hai

```
npm run dev  →  tsx watch src/index.ts
```

1. **`index.ts`** → `createApp()` bulata hai, phir `app.listen(3000)`
2. **`app.ts`** → `express()` banata hai, aur yeh **order mein** lagata hai:
   - `express.json()` → JSON body ko `req.body` object banata hai
   - `GET /` → welcome message
   - `/api/v1/user` → `userRouter`
   - `errorMiddleware` → **sabse last**
3. Jab koi file `database.ts` import karti hai, `env.ts` chal jaata hai:
   - `import "dotenv/config"` → `.env` ki values `process.env` mein
   - `getEnv("DB_HOST")` → value nahi mili toh **turant throw** → server start hi nahi hoga

> ⭐ **Fail fast:** Galat config ke saath server chalu hoke baad mein request pe crash ho, usse better hai start pe hi crash ho jaaye. Yahi `getEnv` karta hai.

**Kyun `index.ts` aur `app.ts` alag?** `createApp()` app *return* karta hai, listen nahi karta. Testing mein (jaise supertest) app ko bina port khole use kar sakte ho.

**`tsx`** → TypeScript ko bina build kiye seedha chalata hai. `watch` = file save karo, server restart.

**`"type": "module"`** (package.json) → ESM, yaani `import/export`. Isliye import mein `.js` likhte ho, file `.ts` hote hue bhi — `NodeNext` resolution runtime pe `.js` dhoondhta hai.

---

## 4. Ek request ki zindagi (lifecycle)

```
CLIENT  ──►  express.json()  ──►  ROUTE match  ──►  MIDDLEWARE(s)  ──next()──►  CONTROLLER
                                                         │                          │
                                                   fail → 400/401              SERVICE
                                                                                    │
                                                                              REPOSITORY
                                                                                    │
                                                                               POSTGRES
                                                                                    │
CLIENT  ◄──────────────── res.status().json() ◄──── CONTROLLER ◄───────────────────┘
                                      │
                         koi error throw hua? ──► errorMiddleware ──► 409 / 500
```

> ⭐ **`next()` ka matlab:** "mera kaam ho gaya, agle  (function )wale ko do". Middleware `next()` nahi bulati aur response bhi nahi bhejti → request **atak jaati hai** (hang).

---

## 5. REGISTER — step by step

**Route:** `POST /api/v1/user/register`

```ts
userRouter.post("/register", validateBody(registerSchema), register);
```

### Step 1 — Validation (`validateBody` + Zod)

Body: `{ "name": "Vishal", "email": " VISHAL@Gmail.com ", "password": "secret123" }`

`registerSchema` ([user.validation.ts](src/modules/user/user.validation.ts)):
- `name` → string, trim, min 2
- `email` → string, trim, valid email, **lowercase**
- `password` → string, trim, min 8

`validateBody(schema)` ([user.validation.middleware.ts](src/modules/user/user.validation.middleware.ts)):
- `schema.safeParse(req.body)` → **throw nahi karta**, `{ success, data | error }` deta hai
- fail → **400** + har field ki galti: `[{ field: "email", message: "Invalid email format" }]`
- pass → `req.body = result.data` (ab email clean + lowercase hai) → `next()`

> 💡 **`validateBody` ek function return karta hai** — isko **Higher-Order Function / middleware factory** kehte hain. Ek hi code, alag schema → register aur login dono pe reuse.

> 💡 **Email lowercase kyun?** `Vishal@x.com` aur `vishal@x.com` alag users na ban jaayein, aur login pe case ki wajah se user "nahi mila" na aaye.

### Step 2 — Controller (`register`)

```ts
const { name, email, password } = req.body;
const user = await registerUser(name, email, password);
res.status(201).json(user);
```
**201 Created** → kuch naya bana.

### Step 3 — Service (`registerUser`)

```ts
const hashedPassword = await bcrypt.hash(password, 12);
```

- **Hashing** = one-way. Hash se password wapas nahi ban sakta.
- **Encryption** ≠ hashing. Encryption key se wapas decrypt ho sakta hai. Password kabhi encrypt nahi, hamesha **hash**.
- **`12` = salt rounds / cost factor** → andar 2¹² = 4096 rounds. Jitna zyada, utna slow → brute force mehenga.
- **Salt** = random value jo har password ke saath milayi jaati hai. bcrypt khud banata hai aur hash ke andar hi store karta hai (`$2b$12$<salt><hash>`). Isse:
  - Do users ka same password → **alag hash**
  - **Rainbow table** (pehle se bane hash ki list) kaam nahi karti

> ⭐ **bcrypt hi kyun, sha256 kyun nahi?** sha256 bahut **fast** hai — attacker GPU pe arabon guesses/sec kar sakta hai. bcrypt jaan-bujh ke **slow** hai aur cost badha sakte ho. Password ke liye slow hash chahiye.

### Step 4 — Repository (`createUser`)

```sql
INSERT INTO users (name, email, password)
VALUES ($1, $2, $3)
RETURNING id, name, email, password, created_at AS "createdAt", updated_at AS "updatedAt"
```

- **`$1, $2, $3` = parameterized query** → value SQL string mein chipakti nahi, alag bheji jaati hai. **SQL injection se bachav.**
- **`RETURNING`** → insert ke baad wahi row wapas, alag SELECT ki zaroorat nahi
- **`AS "createdAt"`** → DB ka `snake_case` → JS ka `camelCase`

### Step 5 — Duplicate email → 409

`users.email` pe UNIQUE constraint hai. Same email dubara → Postgres error code **`23505`** (unique_violation).

```ts
if (error.code === "23505") throw new AppError(409, "Email is already registered");
throw error; // baaki errors aage
```

`AppError` → controller se bahar → **Express 5** async error ko khud `errorMiddleware` tak le jaata hai → **409 Conflict**.

> ⭐ **Pehle SELECT karke check kyun nahi kiya?** Race condition: do request ek saath aayein, dono SELECT mein "email nahi hai" dekhein, dono INSERT kar dein. DB ka UNIQUE constraint **atomic** hai — ek hi jeetega. Isliye DB pe bharosa karo.

> ⚠️ **Abhi ki kami:** `createUser` `password` (hash) bhi RETURN karta hai aur controller woh seedha client ko bhej deta hai. Register response mein **password hash leak ho raha hai**. Fix: `PublicUser` return karo.

---

## 6. LOGIN — step by step

**Route:** `POST /api/v1/user/login` → `validateBody(loginSchema)` → `login`

### Service (`loginUser`)

1. `findUserByEmail(email)` → row with **password hash**
   - nahi mila → `null`
2. `bcrypt.compare(plainPassword, user.password)`
   - compare **decrypt nahi karta**. Hash mein se salt + cost nikalta hai, plain password ko usi se hash karta hai, dono hash match karta hai
   - galat → `null`
3. `createAccessToken({ userId: user.id })` → JWT (1h)
4. `await issueRefreshToken(user.id)` → random token, DB mein hash, **nayi family**
5. Return `{ user: { id, name, email }, accessToken, refreshToken }`

### Controller (`login`)

- `null` → **401** `"Invalid email or password"`
- warna → **200** + tokens

> ⭐ **Same message kyun — "Invalid email OR password"?** Agar bolte "email nahi mila" aur "password galat", attacker pata laga leta kaunse emails registered hain. Isko **User Enumeration** kehte hain. Generic message isse rokta hai.

> ⚠️ **Chhota gap (timing attack):** email nahi mila toh `bcrypt.compare` chalta hi nahi → response jaldi aata hai. Email mila toh ~200ms lagte hain. Time naap ke bhi enumeration ho sakti hai. Fix: user na mile tab bhi ek dummy hash se compare karo.

> 💡 **`await issueRefreshToken` kyun?** Andar DB insert hai (Promise). Bina `await` ke `refreshToken` string nahi, **Promise object** hota, aur insert fail hota toh pata bhi nahi chalta.

---

## 7. JWT (Access Token) — gehraai se

File: [src/shared/auth/jwt.ts](src/shared/auth/jwt.ts)

### JWT kya hai?

**JSON Web Token** — teen hisse, `.` se jude, har hissa **Base64URL**:

```
eyJhbGciOiJIUzI1NiJ9 . eyJ1c2VySWQiOiJhYmMiLCJpYXQiOjE3MDAsImV4cCI6MTcwMH0 . SflKxwRJSMeKKF2QT4fwpM
      HEADER                         PAYLOAD                                     SIGNATURE
{alg:"HS256",typ:"JWT"}     {userId:"abc", iat:..., exp:...}          HMAC-SHA256(header.payload, SECRET)
```

| Hissa | Kya hai |
|---|---|
| **Header** | algorithm (`HS256`) |
| **Payload** | data / **claims** — yahan `userId`, `iat` (issued at), `exp` (expiry) |
| **Signature** | header+payload ko **secret** se sign kiya |

> ⚠️ **Sabse important:** JWT **encrypted nahi**, sirf **signed** hai. Koi bhi payload decode karke padh sakta hai (jwt.io pe). Isliye payload mein **sirf `userId`** hai — password, email, balance kabhi nahi.
>
> Signature ka kaam: agar kisi ne payload badla (`userId` kisi aur ka kar diya), signature match nahi karega → reject.

### `createAccessToken`

```ts
jwt.sign(payload, env.jwt.secret, { expiresIn: "1h" })
```
- default algorithm **HS256** (HMAC + SHA256) → **symmetric**: same secret se sign aur verify
- `expiresIn: "1h"` → payload mein `exp` add ho jaata hai

### `verifyAccessToken`

```ts
const decoded = jwt.verify(token, env.jwt.secret);
```
`jwt.verify` teen cheez check karta hai:
1. signature sahi hai (secret se)
2. `exp` nikla toh nahi → `TokenExpiredError`
3. format sahi → warna `JsonWebTokenError`

Phir **runtime check**: `decoded` object hai aur `userId` string hai? Kyunki `jwt.verify` ka return type `string | JwtPayload` hai — TypeScript ko pakka nahi pata andar kya hai. Check ke baad sirf `{ userId }` return.

> ⭐ **Stateless:** Access token DB mein save nahi hota. Server sirf signature check karke maan leta hai. Fayda: har request pe DB call nahi → fast, scale easy. Nuksaan: **token ko beech mein cancel nahi kar sakte** — 1 ghante tak chalega.

> 💡 **Isliye access token short (1h) aur refresh token long (7d)** — short access = chori hua toh nuksaan kam time ke liye.

---

## 8. `authenticate` middleware — protected routes ka gatekeeper

File: [src/modules/user/user.middleware.ts](src/modules/user/user.middleware.ts)

Client header bhejta hai:
```
Authorization: Bearer eyJhbGciOi...
```

**Bearer** = "jiske paas yeh token hai, use access do" (jaise cinema ticket — naam nahi dekha jaata).

Steps:
1. Header nahi, ya `"Bearer "` se start nahi → **401** `"Authentication required"`
2. `authHeader.slice(7).trim()` → `"Bearer "` ke 7 characters hata ke token
3. token khali → **401**
4. `verifyAccessToken(token)` → fail (galat / expired / tampered) → **401** `"Invalid or expired token"`
5. `req.user = { userId }` → `next()`

### `req.user` TypeScript ko kaise pata? — `express.d.ts`

```ts
declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}
```

Isko **Declaration Merging / Module Augmentation** kehte hain. Express ke `Request` interface mein hum apni property jod dete hain. `?` = optional, kyunki public routes pe `req.user` hota hi nahi.

> 💡 `AuthUser` sirf `{ userId }` hai, poora user nahi. Middleware DB call nahi karti — naam/email chahiye toh `/me` DB se laata hai.

### `/protected` aur `/me`

- `/protected` → test route, sirf `userId` wapas
- `/me` → `authenticate` → `getMe` → `getCurrentUser` → `findUserById` → `SELECT id, name, email` (**password select hi nahi**) → **200**, ya user delete ho gaya toh **404**

---

## 9. Refresh Token — kyun chahiye aur kaise bana

### Problem
Access token 1 ghante mein expire. Har ghante user se password maangna bura UX. Access token lamba (30 din) karo → chori hua toh 30 din tak misuse, aur cancel bhi nahi kar sakte (stateless).

### Solution — do tokens

| | Access Token | Refresh Token |
|---|---|---|
| Format | JWT | random 32 bytes → 64 hex chars |
| Life | **1 hour** | **7 days** |
| Kahan bhejte | `Authorization` header, **har** request | body, sirf `/refresh` aur `/logout` pe |
| DB mein? | ❌ (stateless) | ✅ sirf **sha256 hash** (stateful) |
| Cancel ho sakta? | ❌ expire ka wait | ✅ `revoked_at = NOW()` |
| Kaam | API access | naya access token lena |

### Generation — [src/shared/auth/refresh-token.ts](src/shared/auth/refresh-token.ts)

```ts
crypto.randomBytes(32).toString("hex")        // generate
crypto.createHash("sha256").update(t).digest("hex")  // hash
```

- `randomBytes` = **CSPRNG** (cryptographically secure random). `Math.random()` kabhi nahi — woh predictable hai.
- 32 bytes = **256 bits** randomness → guess karna practically impossible.

> ⭐ **Refresh token ka hash kyun store kiya?** Agar DB leak hua, attacker ko sirf hash milenge. Hash se raw token nahi ban sakta, aur server raw token maangta hai. Same logic jo password ke saath hai.

> ⭐ **Yahan bcrypt kyun nahi, sha256 kyun?**
> 1. Token already 256-bit random hai — brute force possible hi nahi, slow hash ki zaroorat nahi.
> 2. Hume hash se **DB mein row dhoondhni** hai (`WHERE token_hash = $1`). sha256 **deterministic** hai — same input = same output. bcrypt har baar random salt lagata hai → same token ka hash har baar alag → lookup impossible.
>
> Password low-entropy hota hai (insaan chunta hai) → bcrypt. Token high-entropy hai → sha256 kaafi.

### `issueRefreshToken(userId, tokenFamilyId?)` — [refresh-token.service.ts](src/modules/user/refresh-token.service.ts)

1. raw token generate
2. hash
3. `familyId = tokenFamilyId ?? crypto.randomUUID()` → login pe nayi family, refresh pe purani
4. `expiresAt = now + 7 din`
5. DB mein `(user_id, token_hash, token_family_id, expires_at)` insert
6. **raw** token return (client ko sirf ek baar milta hai)

> 💡 `??` = **nullish coalescing** → left `null`/`undefined` ho tabhi right. `||` se farq: `||` `""` aur `0` pe bhi right le leta.

---

## 10. Rotation, Family, Reuse Detection — sabse important security part

### Refresh Token Rotation

Har `/refresh` pe:
1. purana refresh **revoke**
2. naya access + **naya refresh** (usi family mein)

```
login      → A1 + R1              family F1
refresh R1 → R1 revoked, A2 + R2  family F1
refresh R2 → R2 revoked, A3 + R3  family F1
```

Ek refresh token **sirf ek baar** use ho sakta hai (one-time use).

### Reuse Detection — chor pakadna

Socho attacker ne R1 chura liya.
- User ne R1 use kiya → R2 mila, R1 revoked
- Attacker R1 bhejta hai → DB mein row mili, par `revokedAt` set hai

Revoked token dubara aana **normal nahi** hai. Iska matlab token do logon ke paas hai. Server nahi jaanta asli kaun hai → **poori family band**.

```ts
if (storedToken.revokedAt) {
  await revokeRefreshTokenFamily(storedToken.tokenFamilyId);
  throw new RefreshTokenReuseError();   // → 401 "Refresh token reuse detected"
}
```

```sql
UPDATE refresh_tokens SET revoked_at = NOW()
WHERE token_family_id = $1 AND revoked_at IS NULL
```

Ab user aur attacker dono ka refresh band → user dobara **login** karega → nayi family. Attacker ke paas password nahi → bahar.

> ⭐ **Token family kyun?** Bina family ke, reuse pe hum sirf *woh ek* token band kar paate. Par attacker ke paas shayad naya wala (R2, R3) bhi ho. Family = ek login session ki poori chain. Ek chain = ek device/session, isliye doosre devices ke logins pe asar nahi.

### `refreshAccessToken` ka poora order

```
raw token → sha256 → DB lookup
   ├─ row nahi         → null      → 401 "Invalid or expired refresh token"
   ├─ revokedAt set    → family revoke + throw → 401 "Refresh token reuse detected"
   ├─ expiresAt <= now → null      → 401 "Invalid or expired refresh token"
   └─ valid            → revoke purana → naya access + naya refresh (same family) → 200
```

> 💡 **Error ke liye `throw` aur baaki ke liye `null` kyun?** `null` sirf "nahi mila" bata sakta hai. Reuse ek alag situation hai jiska alag message chahiye. Custom error class se controller `instanceof RefreshTokenReuseError` karke pehchaan leta hai.

> ⚠️ **Race condition gap:** `find` aur `revoke` alag queries hain. Do `/refresh` request **ek saath** same token se aayein → dono ko row "valid" dikhegi → dono naye tokens le lenge. `revokeRefreshToken` `true/false` return karta hai (`rowCount === 1`) par service us value ko check **nahi** karti. Fix: `if (!(await revokeRefreshToken(hash))) return null;` ya transaction + `SELECT ... FOR UPDATE`.

---

## 11. LOGOUT

**Route:** `POST /api/v1/user/logout`, body `{ "refreshToken": "..." }`

1. Controller check: string hai aur khali nahi → warna **400**
2. `revokeRefreshTokenByValue` → hash → `UPDATE ... SET revoked_at = NOW()`
3. **204 No Content** — hamesha, token mila ho ya nahi

> 💡 **Hamesha 204 kyun?** Logout **idempotent** hona chahiye — do baar logout karo, result same. Aur client ko yeh batane ki zaroorat nahi ki token valid tha ya nahi.

> ⭐ **Logout ke baad access token?** Woh abhi bhi ~1 ghanta chal sakta hai (stateless JWT, DB mein nahi). Sirf refresh band hua. Client ko apna access token delete karna chahiye. Turant band karna ho toh **blacklist** (Redis mein `jti`) ya bahut chhota expiry chahiye.

> 💡 Logout ke baad wahi refresh `/refresh` pe bheja → woh revoked hai → **reuse detection** trigger → family revoke.

---

## 12. Errors — kaise handle hote hain

### `AppError` — [app.error.ts](src/shared/errors/app.error.ts)

```ts
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}
```
- `extends Error` → **inheritance**, stack trace wagairah milta hai
- `super(message)` → parent `Error` ka constructor, `error.message` set
- `public statusCode` → **parameter property**: TypeScript shortcut, `this.statusCode = statusCode` khud ho jaata hai

### `errorMiddleware` — [error.middleware.ts](src/middleware/error.middleware.ts)

- **4 parameters** `(error, req, res, next)` → Express isi se pehchanta hai ki yeh error handler hai (arity check). 3 param hote toh normal middleware maana jaata.
- **Sabse last** register — taaki saari routes ke errors yahan aayein
- `instanceof AppError` → uska status + message (jaise 409)
- baaki → `console.error` + **500** `"Internal server error"` — andar ki detail (SQL error, stack) client ko **nahi** jaati

> ⭐ **Express 5 feature:** async controller mein `throw` ya rejected Promise → Express 5 khud `next(error)` karta hai. Express 4 mein har controller mein `try/catch` + `next(err)` likhna padta tha.

### Kahan kaunsa pattern

| Situation | Kaise handle |
|---|---|
| Duplicate email | service `throw AppError(409)` → errorMiddleware |
| Login galat | service `null` → controller 401 |
| Refresh reuse | service `throw RefreshTokenReuseError` → controller `try/catch` → 401 |
| DB down / unknown | throw → errorMiddleware → 500 |

> 💡 Inconsistency note: `RefreshTokenReuseError` `AppError` extend nahi karta, isliye controller ko khud catch karna padta hai. Agar `class RefreshTokenReuseError extends AppError` (401) hota, toh controller ka `try/catch` hata sakte.

---

## 13. Database layer

### Pool — [database.ts](src/config/database.ts)

**Connection pool** = pehle se khule DB connections ka group. Har query pe naya TCP connection + auth mehenga hai. Pool connection *udhaar* deta hai, query ke baad wapas le leta hai. `pool.query()` yeh khud karta hai.

### Tables

**`users`** (repo mein CREATE nahi, pehle se tha): `id`, `name`, `email` (UNIQUE), `password` (bcrypt hash), `created_at`, `updated_at`

**`refresh_tokens`** (migration 002 + 003):

| Column | Type | Kyun |
|---|---|---|
| `id` | UUID PK, `gen_random_uuid()` | unique id |
| `user_id` | UUID, FK → `users(id)`, **ON DELETE CASCADE** | user delete → uske tokens bhi |
| `token_hash` | TEXT **UNIQUE** NOT NULL | lookup + duplicate nahi (UNIQUE se index bhi ban jaata hai → fast lookup) |
| `token_family_id` | UUID NOT NULL | ek login session ki chain |
| `expires_at` | TIMESTAMPTZ | 7 din |
| `revoked_at` | TIMESTAMPTZ, nullable | `NULL` = active |
| `created_at` | TIMESTAMPTZ default NOW() | audit |

> 💡 **Soft revoke:** row delete nahi karte, `revoked_at` set karte hain. Isi wajah se **reuse detection possible hai** — agar delete kar dete toh purana token "nahi mila" jaisa lagta, reuse pakad hi nahi paate.

> 💡 **TIMESTAMPTZ** = timezone ke saath time. Server kisi bhi timezone mein ho, sahi compare hota hai.

### Migrations — [migrations/](migrations/)

**Migration** = DB schema ka **version control**. Har change ek numbered file. `npm run migrate` (`node-pg-migrate`) jo files nahi chali, sirf woh chalata hai (history ek table mein rakhta hai).

- **001** khali → "baseline": users table pehle se thi, bas history yahan se shuru
- **002** refresh_tokens
- **003** column add karne ka **safe pattern**: pehle nullable add → purani rows mein value bharo → phir `NOT NULL`. Seedha `NOT NULL` add karte toh purani rows ki wajah se fail hota.

---

## 14. Types — password galat jagah na jaaye

| Type | Fields | Kahan |
|---|---|---|
| `User` | id, name, email, **password**, createdAt, updatedAt | DB se, sirf service ke andar (login compare) |
| `PublicUser` | id, name, email | client ko bhejne wala |
| `LoginResponse` | user, accessToken, refreshToken | login response |
| `RefreshToken` | refresh_tokens ki row | repository ↔ service |
| `RefreshResponse` | accessToken, refreshToken | `/refresh` response |
| `AuthUser` | userId | `req.user` |
| `AccessTokenPayload` | userId | JWT ke andar |

> ⭐ **DTO idea:** Internal model (`User`) aur bahar jaane wala shape (`PublicUser`) alag. Type system se galti se password bhejna mushkil ho jaata hai (register wala case chhod ke, jo abhi `User` return karta hai).

---

## 15. Status codes — ek nazar

| Code | Naam | Kab |
|---|---|---|
| 200 | OK | login, `/me`, `/refresh` |
| 201 | Created | register |
| 204 | No Content | logout |
| 400 | Bad Request | Zod fail, refreshToken missing |
| 401 | Unauthorized | login galat, token missing/galat/expired, refresh invalid, reuse |
| 404 | Not Found | `/me` pe user nahi |
| 409 | Conflict | email pehle se |
| 500 | Internal Server Error | DB down, unknown error |

---

## 16. Abhi ke gaps / improvements (interview mein bolna — plus point milta hai)

| # | Gap | Kyun problem | Fix |
|---|---|---|---|
| 1 | Register response mein password hash | sensitive data leak | `PublicUser` return |
| 2 | Refresh mein race condition | same token se 2 parallel requests → 2 valid chains | `revokeRefreshToken` ka boolean check / transaction + `FOR UPDATE` |
| 3 | Login timing difference | user enumeration | dummy bcrypt compare |
| 4 | Rate limiting nahi | brute force login | `express-rate-limit`, account lockout |
| 5 | Password `.trim()` | user ka space wala password badal jaata hai | password trim mat karo |
| 6 | bcrypt 72-byte limit | 72 bytes ke baad ka password ignore | max length validation |
| 7 | Tokens JSON body mein | frontend localStorage mein rakhe toh XSS se chori | refresh ko **httpOnly, Secure, SameSite** cookie |
| 8 | Logout pe access token chalta rehta | 1h window | short expiry / `jti` blacklist |
| 9 | `jwt.verify` mein `algorithms` fix nahi | algorithm confusion attacks ke against defence-in-depth | `{ algorithms: ["HS256"] }` |
| 10 | Expired/revoked tokens DB mein jama | table badhta rehta | cleanup cron job |
| 11 | `/refresh`, `/logout` pe Zod nahi | inconsistent validation | schema + `validateBody` |
| 12 | `user.middleware.ts` mein `jwt`, `env` unused imports | clutter | hata do |
| 13 | Tests nahi | regression pakad nahi paoge | Jest/Vitest + supertest |
| 14 | `helmet`, CORS config nahi | security headers | `helmet()`, `cors({ origin })` |

---

## 17. Glossary — har term ek line mein

| Term | Matlab |
|---|---|
| **Authentication** | kaun ho, verify karna |
| **Authorization** | kya karne ki permission hai |
| **Hashing** | one-way transform, wapas nahi |
| **Encryption** | two-way, key se wapas |
| **Salt** | har password ke saath random value, same password ka alag hash |
| **Cost factor / salt rounds** | bcrypt kitna slow ho (2^n) |
| **Rainbow table** | pehle se bane hash → password ki list |
| **JWT** | signed token: header.payload.signature |
| **Claim** | JWT payload ki ek field (`userId`, `exp`, `iat`) |
| **HS256** | HMAC-SHA256, ek secret se sign + verify (symmetric) |
| **Stateless** | server session store nahi karta, token khud proof hai |
| **Stateful** | server ke paas record (DB) hai |
| **Bearer token** | jiske paas token, uska access |
| **Access token** | short-lived, API access |
| **Refresh token** | long-lived, naya access lene ke liye |
| **Rotation** | har use pe naya refresh, purana band |
| **Token family** | ek login ki refresh tokens ki chain |
| **Reuse detection** | revoked token dubara aaya = chori ka shak |
| **Revoke** | expiry se pehle band karna |
| **CSPRNG** | secure random generator (`crypto.randomBytes`) |
| **Entropy** | kitna random / guess karna kitna mushkil |
| **Deterministic** | same input = same output |
| **Middleware** | request aur controller ke beech ka function |
| **`next()`** | agle middleware/handler ko control |
| **Higher-order function** | function jo function return kare (`validateBody`) |
| **Zod `safeParse`** | validate, throw nahi, result object |
| **Parameterized query** | `$1` placeholder, SQL injection se bachav |
| **Connection pool** | reusable DB connections |
| **Migration** | DB schema ka versioned change |
| **Foreign key / CASCADE** | doosri table se link / parent delete → child delete |
| **Soft delete / revoke** | row na mitao, flag/time set karo |
| **Declaration merging** | existing TS interface mein property jodna (`req.user`) |
| **Idempotent** | kitni baar bhi karo, result same |
| **User enumeration** | pata lagana kaun sa email registered hai |
| **Timing attack** | response time se secret info nikalna |
| **Race condition** | do parallel operations ka order result bigaad de |
| **Fail fast** | galti ho toh turant crash, baad mein nahi |
