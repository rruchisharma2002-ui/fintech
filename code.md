# Request Flow — Client se Server tak

Client request bhejta hai, server response deta hai.

Pehle flow yeh tha:

**route → controller → service → repository (agar DB chahiye) → postgres**

Ab beech mein **middleware** bhi aa gaya. Kuch routes pe validation, kuch pe JWT auth.

**route → middleware (agar laga ho) → controller → service → repository → postgres**

Isko loosely **MVC architecture** bhi bolte hain (kuch kuch).

---

## Poora Flow (simple)

```
CLIENT (Postman / frontend)
        ↓  request
     ROUTE            →  API path / endpoint decide
        ↓
   MIDDLEWARE         →  pehle check (validation ya token)
        ↓  next()
   CONTROLLER         →  req aayi, res wapas bhejega
        ↓
    SERVICE           →  kaam karega (input lo, output do)
        ↓
  REPOSITORY          →  DB se baat (agar data chahiye)
        ↓
   POSTGRES           →  asal database
        ↓
response wapas controller ke through client ko
```

**Kaun kisko connect karta hai:**

- **Route** connect karta hai **middleware** / **controller** ko
- **Middleware** theek raha toh `next()` se **controller** ko
- **Controller** connect karta hai **service** ko
- **Service** connect karta hai **repository** ko (agar DB chahiye)
- **Repository** connect karta hai **postgres** ko, **pool** se

---

## 1. Route

**Kaam:** woh path banana jahan request aayegi.

Hum route banate hain jahan hamari request aayegi.

Ab routes yeh hain:

- `POST /api/v1/user/register`
- `POST /api/v1/user/login`       ← access token + refresh token
- `GET  /api/v1/user/me`          ← access token chahiye
- `GET  /api/v1/user/protected`   ← access token chahiye
- `POST /api/v1/user/refresh`     ← purana refresh token se naya pair
- `POST /api/v1/user/logout`      ← refresh token revoke

**Dhyan:** path `user` hai, `users` nahi.  
`/api/v1/users/register` → **404** `Cannot POST ...`  
Sahi: `/api/v1/user/register`

Is route pe request aayi, ab **kaun handle karega req aur res?**

→ pehle **middleware** (agar route pe laga ho), phir **controller**

Route khud kaam nahi karta.  
Route sirf bolta hai: *is path pe pehle yeh middleware, phir yeh controller chalao.*

```ts
userRouter.post("/register", validateBody(registerSchema), register);
userRouter.post("/login", validateBody(loginSchema), login);
userRouter.get("/me", authenticate, getMe);
```

Yahan order matter karta hai:

1. pehla function pehle chalta hai
2. woh `next()` bole tabhi agla chalta hai
3. last wala controller hota hai, wahi `res` bhejta hai

---

## 2. Controller  ✅ clear? yessss

Controller HTTP se baat karta hai:

- `req.body` se data nikaalta hai
- service ko call karta hai
- HTTP status + JSON bhejta hai

Register success → **201 Created**.  
Login fail → **401 Unauthorized**.  
`/me` pe user nahi mila → **404 Not Found**.

Password hash yahan nahi hota. Woh service ka kaam hai.  
Token banana bhi yahan nahi hota. Woh bhi service ka kaam hai.

Controller ke paas **`req`** aur **`res`** hota hai.

**Controller responsible hai:**

- request lena (`req`)
- response wapas bhejna (`res`)

Controller ka dusra kaam:

> is request ko fulfill karne ke liye **konsi service** use karun?

Controller DB se seedha baat nahi karta.  
Controller service ko call karta hai.

```ts
export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const user = await registerUser(name, email, password);
  res.status(201).json(user);
}
```

Yahan kya hua:

1. `req.body` se data nikala
2. service `registerUser(...)` ko call kiya
3. jo result aaya, woh `res` se client ko bhej diya

Login mein bhi same, bas ab service **user + accessToken + refreshToken** deti hai, sirf user nahi.

Naya controller: **`getMe`**

- `req.body` nahi dekhta
- token se jo user id mili, woh `req.user.userId` pe padi hai
- us id se service `getCurrentUser` call karti hai
- user mila → JSON, nahi mila → 404

```ts
export async function getMe(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!req.user || !userId) {
    res.status(401).json({ message: "User not authenticated" });
    return;   // return zaroori hai, warna neeche query bhi chal jaayegi
  }
  const user = await getCurrentUser(userId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(user);
}
```

---

## 3. Service

Service ka kaam **sirf input leke output dena** hai.

Service **req / res** nahi dekhti.  
Service ko **HTTP se matlab nahi**.

Uske liye:

- input = name, email, password  (ya userId)
- output = user, ya token wala object, ya null

**Important points:**

- Service **independent** ho sakti hai
- **Kai controllers same service** use kar sakte hain
- Controller ke paas req aati hai, lekin service ke paas **directly req nahi** aati
- Controller req se data nikal ke **plain input** service ko deta hai

```ts
registerUser(name, email, password)
loginUser(email, password)
getCurrentUser(userId)
```

Register service kya karti hai:

1. password ko hash karti hai (`bcrypt.hash`)
2. repository ko bolti hai: user bana do
3. user return karti hai

Login service kya karti hai (**ab naya part JWT**):

1. email se user nikaalo (repository se)
2. user nahi mila → `null`
3. password compare karo
4. match nahi hua → `null`
5. match hua → **JWT token banao**, phir `{ user, accessToken }` return

`getCurrentUser` kya karti hai:

1. userId se repository `findUserById` call
2. mila toh PublicUser, nahi toh `null`

---

## 4. Repository

Jo kaam **DB se** karwana hai, jaise DB se interaction,  
uska function hum **repository** mein likhenge.

Repository **directly database** se baat karti hai.  
Connection **pool** se bani hoti hai.

Repository ke functions:

- `createUser(...)` → DB mein naya user insert
- `findUserByEmail(...)` → email se user dhoondho
- `findUserById(...)` → **naya**, id se user dhoondho (`/me` ke liye)

`findUserById` password nahi nikalta.  
`/me` pe hashed password nahi bhejna, isliye sirf `id, name, email`.

SQL mein last column ke baad **comma mat lagana**.

Galat:

```sql
SELECT id, name, email, password,   -- extra comma
FROM users
```

Sahi:

```sql
SELECT id, name, email
FROM users
WHERE id = $1
```

Extra comma se error aata hai: **`syntax error at or near "FROM"`**

**Promise wala point:**

Function ke parameters mein woh data aata hai jo promise se pehle pata hota hai  
(jaise name, email, password, id).

Phir **promise** mein decide hota hai return kya hoga:

- mila toh **user**
- nahi mila toh **null**

```ts
export async function findUserByEmail(email: String): Promise<User | null> {
  // ...
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0] || null;
}
```

Abb isko **service** mein call karenge.

---

## 5. Postgres (DB)

Asal data yahan pada hai, table `users` mein.

Repository `pool.query(...)` se SQL chalaati hai.

Pool matlab: ready connections ka group, har baar naya connection nahi banana padta.

Pehle password code mein hardcoded tha.  
Ab pool **`.env`** se values leta hai (`env.ts` ke through).

Agar `.env` ka `DB_PASSWORD` galat ho, toh login/register se pehle hi yeh error:

**`password authentication failed for user "postgres"`** → **500**

Yeh user ka password galat nahi, **database ka password** galat hai.

---

# Naya kya add hua

Yeh cheezein baad mein aayi. Purana flow same hai, upar extra layers lagi hain.

---

## 6. `.env` aur `env.ts` — secrets code se bahar

**Problem:** password, JWT secret code mein likhoge toh git pe chala jaayega. Galat.

**Solution:** values `.env` file mein, code sirf unke **names** padhta hai.

`.env` mein aisa hota hai (example, asli values yahan mat likho):

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=........
DB_NAME=fincore
JWT_SECRET=........
```

`src/config/env.ts` kya karta hai:

- `dotenv/config` se `.env` load hota hai `process.env` mein
- `getEnv("DB_HOST")` value nikaalta hai
- value missing ho toh error: `Missing environment variable: ...`
- `env.db` aur `env.jwt.secret` export karta hai

`database.ts` ab aise pool banata hai:

```ts
export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
});
```

`.env` change kiya toh **server restart** karo. Purani values memory mein rehti hain.

`.gitignore` mein `.env` hai, isliye git pe nahi jaati. Sahi hai.

---

## 7. Middleware kya hota hai

Middleware = beech ka function. Route aur controller ke **beech** khada hota hai.

Uske paas bhi `req, res` hota hai, plus **`next`**.

- kaam theek → `next()` bolo, agla function chale (controller)
- kaam galat → `res.status(...).json(...)` bhejo, `next()` mat bolo, request wahin ruk jaaye

Do middleware hain ab:

| Middleware | File | Kab chalta hai | Kya check karta hai |
|---|---|---|---|
| `validateBody` | `user.validation.middleware.ts` | register, login | body sahi hai ya nahi (Zod) |
| `authenticate` | `user.middleware.ts` | `/me`, `/protected` | JWT token sahi hai ya nahi |

Controller se pehle yeh chalenge. Body galat / token galat hua toh controller tak request **jaati hi nahi**.

---

## 8. Zod validation — body check karna

File: `user.validation.ts`

Zod ek library hai. Hum usse **schema** likhte hain: body kaisi honi chahiye.

`registerSchema`:

- `name` → string, trim, kam se kam 2 character
- `email` → string, trim, valid email, lowercase
- `password` → string, trim, kam se kam 8 character

`loginSchema`:

- `email` + `password` (name nahi, login pe name nahi chahiye)

Yeh schema khud request nahi rokta.  
Isko `validateBody(registerSchema)` ke through route pe lagate hain.

File: `user.validation.middleware.ts`

```ts
export function validateBody(schema: ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: [ { field, message } ]
      });
    }
    req.body = result.data;  // saaf / trimmed data
    next();
  };
}
```

`validateBody(registerSchema)` ek **function return** karta hai.  
Isliye route pe aise likhte hain, seedha `validateBody` nahi.

**`safeParse`:** crash nahi karta. Result milta hai:

- `success: true` + `data`
- `success: false` + `error`

Galat body pe **400**, controller call nahi hota.

Example: password `Test` (4 letter) bheja → 400, `"Password must be at least 8 characters long"`

`req.body = result.data` isliye: trim / lowercase Zod ne kar diya, controller ko saaf data mile.

---

## 9. JWT — login ke baad token

Pehle login ke baad sirf user JSON jaata tha. Server ko next request pe pata nahi chalta tha *kaun ho tum*.

Ab login success pe **do** tokens milte hain:

- **accessToken** — chhota JWT, 1 ghanta. Protected APIs pe header mein yeh bhejte ho.
- **refreshToken** — lamba random secret, 7 din. Access expire hone ke baad naya access lane ke liye. DB mein iska **hash** rehta hai, raw token nahi.

Service mein:

```ts
const accessToken = jwt.sign(
  { userId: user.id },   // payload — andar kya rakha
  env.jwt.secret,        // secret — isse token sign / verify
  { expiresIn: "1h" }    // 1 ghante baad expire
);
```

`jwt.sign` = token **banana**  
`jwt.verify` = token **check** karna (authenticate middleware mein)

Login ab `User` nahi, **`LoginResponse`** return karta hai:

```ts
{
  user: { id, name, email },   // password nahi
  accessToken: "eyJhbGciOi...",
  refreshToken: "a1b2c3..."    // raw secret, client ke paas. DB mein hash
}
```

Password isliye nahi: client ko hash nahi dikhana.

Postman mein `/me` ke liye header:

```
Authorization: Bearer <yahan accessToken paste>
```

`Bearer` ke baad **space**, phir token. Bina `Bearer ` ke middleware 401 dega: `"Authentication required"`.

---

## 10. `authenticate` middleware — token padhna

File: `user.middleware.ts`

Protected route pe controller se **pehle** yeh chalta hai.

Step by step:

1. `req.headers.authorization` nikaalo
2. header nahi / `Bearer ` se start nahi → **401** `"Authentication required"`
3. `authHeader.split(" ")[1]` → token alag ho gaya
   - `"Bearer abc.xyz"` → pehla `"Bearer"`, dusra token
4. `jwt.verify(token, env.jwt.secret)` → token asli hai? expire toh nahi?
5. payload mein `userId` string honi chahiye, nahi toh **401** `"Invalid token payload"`
6. `req.user = { userId }` set karo
7. `next()` → ab controller `getMe` chalegi

Verify fail (galat token / expire) → catch → **401** `"Invalid token"`

**Yaad rakh:**

- middleware token **check** karti hai
- controller us token se user **DB se nikaalti** hai
- `req.user` mein poora user nahi, sirf `{ userId }`

---

## 11. `req.user` kaise possible hua — `express.d.ts`

Express ke `Request` type mein default `user` nahi hota.  
Hum khud add karte hain.

File: `src/types/express.d.ts`

```ts
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
```

Iska matlab: har `req` pe optional `user` ho sakta hai.

`?` ka matlab: hamesha nahi hoga. Login/register pe nahi, sirf authenticate ke baad.

`AuthUser` (`user.auth.types.ts`):

```ts
export type AuthUser = {
  userId: string;
};
```

Yeh **DB wala User nahi**. Sirf token se nikli id.  
Poora name/email `/me` pe repository se aata hai.

---

## 12. Types — User vs PublicUser vs LoginResponse vs AuthUser

File: `user.types.ts` + `user.auth.types.ts`

| Type | Kya hai | Password? | Kab use |
|---|---|---|---|
| `User` | poora DB user | haan | register, findUserByEmail (hash compare ke liye) |
| `PublicUser` | id, name, email | nahi | `/me`, login ke andar user |
| `LoginResponse` | `{ user, accessToken, refreshToken }` | nahi | login ka output |
| `RefreshToken` | DB row: id, userId, tokenHash, expiresAt, revokedAt, createdAt | nahi | refresh_tokens table |
| `RefreshResponse` | `{ accessToken, refreshToken }` | nahi | `POST /refresh` ka output |
| `AuthUser` | `{ userId }` | nahi | token se `req.user` |

Alag types isliye: galat jagah password leak na ho, TypeScript rok de.

---

## 13. `GET /me` ka poora flow

Client pehle login kare, token le, phir:

```
GET /api/v1/user/me
Header: Authorization: Bearer <token>
```

Body nahi chahiye. GET pe body nahi hoti.

```
CLIENT
  → ROUTE /me
  → authenticate middleware (token check, req.user set)
  → getMe controller (req.user.userId nikaala)
  → getCurrentUser service
  → findUserById repository
  → Postgres SELECT id, name, email WHERE id = $1
  → PublicUser JSON wapas
```
/*
Postman: GET /api/v1/user/me
         Header: Bearer eyJ...

1. ROUTE          /me → pehle authenticate, phir getMe
2. authenticate   token sahi? haan
                  req.user = { userId: "abc-123" }
                  next()
3. getMe          req.user.userId nikala
                  getCurrentUser("abc-123") call
4. getCurrentUser findUserById("abc-123")
5. repository     SELECT id, name, email FROM users WHERE id = $1
6. Postgres       row deti hai
7. getMe          res.json({ id, name, email })*/ 
---

## 14. Destructuring (HW)

Yeh line:

```ts
const { name, email, password } = req.body;
```

Iska matlab:

`req.body` ek object hai, jaise:

```js
{
  name: "Ruchi",
  email: "ruchi@mail.com",
  password: "secret"
}
```

Destructuring se teen alag variables mil jaate hain:

- `name`
- `email`
- `password`

Bina destructuring ke aise likhte:

```ts
const name = req.body.name;
const email = req.body.email;
const password = req.body.password;
```

Dono same kaam. Pehli wali short hai.

`authenticate` mein bhi splitting hai, thoda alag:

```ts
const token = authHeader.split(" ")[1];
```

Yahan object nahi, **string** ko space se kaat rahe hain.

> **HW:** Learn about destructuring

---

## 15. bcrypt.compare — hamesha confusion wali line

```ts
const passwordMatches = await bcrypt.compare(password, user.password);
```

Yahan hamesha confusion rehti hai:

**Pehle konsa aayega?**

- req mein aaya password?
- ya original / DB wala jisse compare karna hai?

### Answer (yaad rakh):

**(req mein aaya, original se compare)**

Order yeh hai:

```ts
bcrypt.compare(PEHLA, DUSRA)
                 ↓        ↓
         req wala     DB wala hash
         password     (user.password)
```

| Position | Kya hai | Kahan se aaya |
|---|---|---|
| **1st** `password` | jo user ne abhi type kiya | `req.body` → controller → service |
| **2nd** `user.password` | DB mein saved **hash** | repository se mila user |

`bcrypt.compare` hash ko wapas password nahi banata.  
Woh check karta hai: *kya yeh plain password usi hash se match karta hai?*

- match → `true`
- nahi → `false`

Isliye:

```
(req me aaya, original se compare)
```

---

## 16. Login request ka example (ab token ke saath)

Client bhejta hai:

```
POST /api/v1/user/login
{
  "email": "ruchi@mail.com",
  "password": "secret12"
}
```

Phir yeh hota hai:

1. **Route** → `/login`, pehle `validateBody(loginSchema)`
2. **Validation middleware** → email/password shape check, theek ho toh `next()`
3. **Controller** → `req.body` se `email, password` nikala, service ko diya
4. **Service** → user chahiye email se
5. **Repository** → `SELECT ... WHERE email = $1`
6. **Postgres** → user row (ya kuch nahi)
7. **Service** → `bcrypt.compare(req wala, DB wala hash)`
8. **Service** → match hua toh `jwt.sign` se access token, aur `issueRefreshToken` se refresh token
9. **Controller** → `{ user, accessToken, refreshToken }` client ko

Uske baad `/me`:

10. Postman header mein `Authorization: Bearer <token>`
11. `authenticate` token verify karke `req.user` set
12. `getMe` → `getCurrentUser` → `findUserById` → name/email JSON

---

## 17. npm `-D` kya hai

```
npm install -D @types/jsonwebtoken
```

yha `-D` why?

`-D` = **devDependencies**

ye package module sirf development ke time kam aate hain.  
Jab tak hum code likhte / TypeScript compile karte, tab chahiye.  
Live / production pe inki need nahi, wahan ye install nahi hote.

`@types/...` sirf types hain, runtime pe kaam nahi karte.

**dependencies** (bina `-D`) woh hain jo server chalate time chahiye:
(when backend mai code deploy hota heh to vha bi download hote)
- `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `zod`

**devDependencies** (`-D`):

- `typescript`, `tsx`, `@types/express`, `@types/jsonwebtoken`, ...
(only develompment ke time use hote)
---

## Short yaad rakhne wali cheezein

- **Route** = path / endpoint, request yahan aati hai
- **Middleware** = beech ka check, `next()` se aage, nahi toh yahin `res` se rok do
- **Controller** = `req` lo, `res` do, service choose karo
- **Service** = input lo, output do, req/res se matlab nahi
- **Repository** = DB se baat, pool se connection
- **Postgres** = asal database
- Service independent hai, kai controllers use kar sakte hain
- Controller ke paas req aati hai, service ke paas nahi
- Repository return: mila toh user, nahi mila toh null
- `bcrypt.compare(password, user.password)` = **(req wala, DB wala hash)**
- Validation fail → **400**, token fail → **401**, user nahi mila → **404**, DB/crash → **500**
- Login **access token + refresh token** deta hai. `/me` access token se current user nikaalta hai
- Access expire → `POST /refresh`. Logout → refresh token **revoke**, response **204** (body khali)
- `req.user` token se aaya `{ userId }` hai, poora user nahi
- URL ` /api/v1/user/... ` hai, `users` nahi

`express()` → naya app object.  
`express.json()` → JSON body ko `req.body` banaata hai. Bina iske name, email, password nahi milenge.  
`GET /` → health/test route.  
`app.use("/api/v1/user", userRouter)` → user wale routes is prefix ke neeche.

Isliye:

- `/register` actually `/api/v1/user/register`
- `/login` actually `/api/v1/user/login`
- `/me` actually `/api/v1/user/me`
- `/refresh` actually `/api/v1/user/refresh`
- `/logout` actually `/api/v1/user/logout`

---

## 18. Folders — TypeScript, types, code kahan rehta hai

TypeScript = JavaScript + **types**. Galat type likho toh compile time pe pakad lega, server chalne se pehle.

Code ek file mein nahi. **Folders** kaam ke hisaab se code rakhte hain:

| Folder / file | Kya hold karta hai |
|---|---|
| `src/index.ts` | server start (`listen`)define  under script in package.json  |
| `src/app.ts` | Express app instance + routes attach |
| `src/config/` | `env.ts`, `database.ts` (pool) |
| `src/modules/user/` | route, middleware, controller, service, repository, validation, types. Refresh: `refresh-token.service.ts`, `refresh-token.repository.ts`, `refresh-token.types.ts` |
| `src/shared/` | ek definition jo kai files use karein (`jwt.ts`, `refresh-token.ts`, `app.error.ts`) |
| `migrations/` | SQL. `002_create_refresh_tokens.sql` → `refresh_tokens` table |
| `src/middleware/` | error middleware |
| `src/types/express.d.ts` | `req.user` type add |

`user.types.ts` aur `user.auth.types.ts` sirf **shapes** hain (`User`, `PublicUser`, `AuthUser`). Woh request handle nahi karte.

---

## 19. `dependencies` aur `devDependencies`

`package.json` mein do lists hain.

**dependencies** — backend ko jab server **chalta** hai tab chahiye. Inhe code use karta hai:

- `express` — HTTP server
- `pg` — Postgres
- `bcrypt` — password hash
- `jsonwebtoken` — token
- `dotenv` — `.env` load
- `zod` — body check

**devDependencies** (`npm install -D`) — sirf likhte / TypeScript chalate time. Production runtime ko inki zaroorat nahi.

- `typescript` — `.ts` compile
- `tsx` — `.ts` seedha chalaata hai, alag build ke bina
- `@types/express`, `@types/jsonwebtoken`, `@types/node`, `@types/pg`, `@types/bcrypt` — downloaded **type** libs. Runtime pe kaam nahi karte. TypeScript ko batate hain library ka shape kya hai.

---

## 20. Script `dev` — server kaise start hota hai

```json
"dev": "tsx watch src/index.ts"
```

`npm run dev` yeh karta hai:

1. `tsx` TypeScript file chalaata hai
2. `watch` file change pe server restart
3. entry file **`src/index.ts`** hai, `app.ts` nahi

`index.ts` app ko **pass / start** karta hai:

```ts
import { createApp } from "./app.js";

const app = createApp();
app.listen(3000, ...);
```
createApp() andar express() ek baar chalta hai aur wohi object return karta hai. listen bhi usi instance ka method hai. Port 3000 pe jo requests aati hain, woh isi app ke routes pe jaati hain.

`app.ts` request **handle** karta hai: `express()`, `express.json()`, routes, error middleware.

Order:

```
npm run dev
  → index.ts          server listen
  → app.ts            express instance
  → route
  → validator / auth middleware   (jo route pe laga ho)
  → controller
  → service
  → repository
  → postgres
```

Register / login pe pehle **validator** (`validateBody`).  
`/me` pe validator nahi, **`authenticate`** middleware.

---

## 21. ES modules aur `require` ka farq

`package.json` mein:

```json
"type": "module"
```

Is project mein **ES modules** hain:

```ts
import express from "express";
export function createApp() { ... }
export default userRouter;
```

Purana CommonJS aisa hota tha:

```js
const express = require("express");
module.exports = createApp;
```

Yahan `require` use nahi hota. `import` / `export` hota hai.

`tsconfig` mein `"module": "NodeNext"` hai. Isliye import path **`.js`** pe khatam hota hai, chahe file `.ts` ho:

```ts
import { createApp } from "./app.js";
```

Source file `app.ts` hai. Node ko compiled output ka naam `.js` chahiye, isliye import mein `.js` likhte hain.

---

## 22. `env.ts` aur `process.env`

`.env` ek file hai. `process.env` file nahi hai.

`src/config/env.ts` sabse upar:

```ts
import "dotenv/config";
```

Yeh `.env` ki values **running process** pe chadhata hai, `process.env` object mein.

Phir hum us object se padhte hain:

```ts
const value = process.env[name];   // jaise process.env["DB_HOST"]
```

`getEnv("DB_HOST")` missing ho toh throw: `Missing environment variable: DB_HOST`.

Export:

- `env.db` → host, port, user, password, database
- `env.jwt.secret` → token sign / verify

`database.ts` pool inhi values se banta hai. Password code mein nahi, `.env` mein.

`.env` badlo toh server **restart**. Purani values us process ki memory mein rehti hain.

---

## 23. Postgres — seedhi query. Prisma nahi.

Repository `pool.query(...)` se **SQL khud** likhti hai:

```sql
SELECT id, name, email
FROM users
WHERE id = $1
```

`$1` placeholder hai. Value alag array mein jaati hai: `[id]`. Isse query string mein user input chipakta nahi.

**Prisma** ek ORM hai. **Mongoose** bhi ORM jaisa hai, MongoDB ke liye. ORM mein tum object / method likhte ho, library SQL banati hai.

Is project mein Prisma nahi hai. `pg` ka `Pool` hai, query hum likhte hain.

---

## 24. Service ko input milta hai. DB seedha kyu nahi.

Service ke paas `req` nahi aata. Controller plain input deta hai:

```ts
registerUser(name, email, password)
loginUser(email, password)
getCurrentUser(userId)
refreshAccessToken(refreshToken)
revokeRefreshTokenByValue(refreshToken)
```

Service ka output: user, `{ user, accessToken, refreshToken }`, `{ accessToken, refreshToken }`, ya `null`.

SQL service mein nahi. **Repository** abstraction hai.

Agar service seedha `pool.query` chalaye:

- wahi query baar baar likhni padegi
- DB badla toh har service chhedni padegi
- HTTP aur database ek dusre se **alag** nahi rehte (decouple mushkil)

Ab:

- service bolti hai `findUserById(userId)`
- repository decide karti hai SQL kya hai
- kai functions same repository use kar sakte hain

Repository **input** leti hai (name, email, id) aur **output** deti hai (row ya `null`). Beech mein Postgres.

---

## 25. Shared / util — ek definition, kai files
HELPER FUNCTION HOTEE
Alag `util` folder nahi hai. Same idea `src/shared/` mein hai.

**Ek jagah likho, kai files import karein.**

`src/shared/auth/jwt.ts`:

- `createAccessToken` — login **service** aur refresh **service** access token banati hai
- `verifyAccessToken` — **authenticate middleware** token check karti hai

Dono jagah `jwt.sign` / `jwt.verify` dubara nahi likha. Secret bhi `env.jwt.secret` se ek hi jagah.

`src/shared/auth/refresh-token.ts`:

- `generateRefreshToken` — random raw secret
- `hashRefreshToken` — sha256. Same input, same hash. DB lookup isi se hoti hai

Login service aur refresh service dono inhe import karti hain. Hash logic ek jagah.

`src/shared/errors/app.error.ts` bhi wahi idea: `AppError` ek class, service throw karti hai, error middleware status bhejti hai.

---

## 26. `express()` ek instance hai

```ts
export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/user", userRouter);
  app.use(errorMiddleware);
  return app;
}
```

`express()` naya **app object** deta hai. Usi instance pe middleware aur routes lagte hain.
app.use(express.json()) — is app ki har request pe JSON body req.body banegi
app.get("/") — is app pe GET / ka route
app.use("/api/v1/user", userRouter) — is app pe user routes
app.use(errorMiddleware) — is app ki errors isi middleware tak aayengi
`user.middleware.ts` ka `authenticate` app-wide nahi hai. Sirf un routes pe hai jahan likha hai:

```ts
userRouter.get("/me", authenticate, getMe);
```
---

## 27. Header se token — `Bearer`, phir verify

Protected route pe token **header** mein aata hai, body mein nahi.

```
Authorization: Bearer eyJhbGciOi...
```

`authenticate` (`user.middleware.ts`) controller se **pehle** chalta hai:

1. `req.headers.authorization` nikaalo
2. header missing hai, ya `Bearer ` se start nahi hota → **401** `"Authentication required"`
3. `"Bearer "` **7 characters** hai, isliye `authHeader.slice(7).trim()` se token alag ho jata hai
   - pehle `Bearer`, space, phir token
4. token khali → phir **401**
5. `verifyAccessToken(token)` — signature check, expire check, payload mein `userId`
6. `req.user = { userId }`
7. `next()` — ab `getMe` chalegi

Galat / expired token → **401** `"Invalid or expired token"`.

`jwt.verify` token ko padhta hai aur sachchai check karta hai. Yahi “decode at start” hai: controller se pehle, middleware mein. Controller DB se user nikalta hai. Middleware sirf token se `userId` nikaalti hai.

`/refresh` aur `/logout` pe `authenticate` **nahi** lagta. Wahan access token nahi, body mein **refresh token** aata hai.

---

## 28. Do tokens — access aur refresh

Access token JWT hai. Server usko DB mein nahi rakhta. Signature + expire check karke maan leta hai.

Problem: access **1 ghante** mein expire ho jata hai. User ko baar baar password dalna padega.

Isliye doosra token:

| | Access token | Refresh token |
|---|---|---|
| Kya hai | JWT (`jwt.sign`) | random 32 bytes, hex string |
| Kitne din | 1 hour | 7 din |
| Kahan jaata hai | `Authorization: Bearer ...` | body: `{ "refreshToken": "..." }` |
| DB mein | nahi | **hash** (`sha256`), raw nahi |
| Revoke | nahi ho sakta, expire ka wait | `revoked_at` set karke turant band |

Refresh token **secret** hai jo client ko milta hai. DB mein wahi string nahi. Uska hash store hota hai. DB leak ho toh raw token nahi milta.

---

## 29. Refresh token banana — `issueRefreshToken`

File: `src/shared/auth/refresh-token.ts`

Do functions. Dono **pure** hain jahan hash ki baat hai: **same input pe same output**.

```ts
generateRefreshToken()   // crypto.randomBytes(32).toString("hex")
hashRefreshToken(token)  // sha256 → hex
```

`generateRefreshToken` har baar **naya** random secret deta hai. Yahi client ke paas jaata hai.

`hashRefreshToken` same token pe hamesha same hash deta hai. Isliye baad mein client jo token bhejta hai, usko phir hash karke DB ki row dhoondh sakte ho.

Service (`refresh-token.service.ts`) login pe yeh karti hai:

```
issueRefreshToken(userId)
   ├── generate refresh token     ← asal secret, client ko yahi milega
   ├── hash it                    ← DB mein hash, raw nahi
   ├── expiry = ab + 7 din
   └── repository se hash save
   return raw token               ← user / client ko
```

Login service mein:

```ts
const accessToken = createAccessToken({ userId: user.id });
const refreshToken = await issueRefreshToken(user.id);
```

**`await` yahan zaroori hai.** `issueRefreshToken` andar DB call karti hai. Bina `await` ke function refresh token save hone se **pehle** return kar degi, aur client ko token nahi milega — Promise milega.

Repository insert (`refresh-token.repository.ts`):

```sql
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
```

Table `migrations/002_create_refresh_tokens.sql`:

- `id` — UUID
- `user_id` — `users.id` pe foreign key. User delete → yeh rows bhi delete (`ON DELETE CASCADE`)
- `token_hash` — UNIQUE. Same hash do baar nahi
- `expires_at` — kab natural expire
- `revoked_at` — null matlab abhi valid. Time set = pehle hi band kar diya
- `created_at`

Do raaste, ek token:

```
Refresh token (raw)
        │
   ┌────┴────┐
   ▼         ▼
generate   hash
   │         │
   │         ▼
   │     PostgreSQL  (token_hash column)
   │         │
   └────► repository
```

Client ko raw milta hai. DB ko hash milta hai.

---

## 30. `POST /refresh` — naya access get, purana refresh band send

Route:

```ts
userRouter.post("/refresh", refresh);
```

Body validation Zod se nahi. Controller khud check karta hai: `refreshToken` string ho aur khali na ho. Nahi toh **400** `"Refresh token is required"`.

Client **raw** refresh token bhejta hai, hash nahi. Server khud hash karta hai.

```
CLIENT
  POST /api/v1/user/refresh
  { "refreshToken": "<raw>" }
        ↓
  refresh controller
        ↓
  refreshAccessToken(raw)
        ↓
  hashRefreshToken(raw)          ← same hash jo login pe save hua by sha256
        ↓
  findRefreshTokenByHash
        ↓
  teen check:
    1. row nahi  → null
    2. revokedAt set hai  → null
    3. expiresAt guzar chuka  → null
        ↓
  null aaya → controller 401 "Invalid or expired refresh token"
        ↓
  theek hai toh:
    1. purana token revoke   (revoked_at = NOW())
    2. naya access token     (jwt, 1h, usi userId pe)
    3. naya refresh token    (issueRefreshToken — naya raw + naya hash)
        ↓
  200 { accessToken, refreshToken }
```

Matlab: client refresh bhejta hai. Server dekhta hai token **valid** hai, **revoke** nahi hua, **expire** nahi hua. Phir naya access **aur** naya refresh deta hai.

Purana refresh is step pe revoke ho jata hai. Woh dubara use nahi ho sakta. Isse kehte hain **rotation**: har refresh pe naya refresh, purana band.

`RefreshResponse`:

```ts
{
  accessToken: string;
  refreshToken: string;
}
```

---

## 31. `POST /logout` — revoke

Route:

```ts
userRouter.post("/logout", logout);
```

Logout ka matlab session password se nahi, **refresh token revoke** karke band karna. Revoke = token ko uski natural expiry se **pehle** cancel kar dena.

Controller:

1. body mein `refreshToken` string aur non-empty? nahi → **400**
2. `revokeRefreshTokenByValue(refreshToken)`
3. **204** aur **koi body nahi**

**204** isliye: logout ho gaya, wapas bhejne layak kuch nahi. `res.status(204).send()`.

Service raw token hash karti hai, phir repository:

```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE token_hash = $1
  AND revoked_at IS NULL
```

Matlab: yeh refresh token dhoondo, aur agar pehle se revoke nahi hai, **ab** revoke mark kar do.

`rowCount === 1` → ek row update hui → `true`. Pehle se revoked / token DB mein nahi → `false`.

Logout controller woh `true/false` **nahi** dekhta. Token mila ya nahi, response **204** hi jaata hai.

Revoke ke baad wahi refresh `POST /refresh` pe **401** dega, kyunki `revokedAt` set hai.

Access token alag hai. Logout us JWT ko DB se nahi mitaata. Woh 1 ghante tak header mein chal sakta hai, jab tak expire na ho. Naya access lene ke liye refresh chahiye, aur woh revoke ho chuka hai.