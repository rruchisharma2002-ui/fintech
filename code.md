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
- `POST /api/v1/user/login`
- `GET  /api/v1/user/me`          ← naya, token chahiye
- `GET  /api/v1/user/protected`   ← naya, token chahiye

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

Login mein bhi same, bas ab service **user + accessToken** deti hai, sirf user nahi.

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

Ab login success pe **accessToken** milta hai.  
Woh token baad ki protected APIs pe header mein bhejna padta hai.

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
  accessToken: "eyJhbGciOi..."
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
| `LoginResponse` | `{ user, accessToken }` | nahi | login ka output |
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
8. **Service** → match hua toh `jwt.sign` se token
9. **Controller** → `{ user, accessToken }` client ko

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

- `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `zod`

**devDependencies** (`-D`):

- `typescript`, `tsx`, `@types/express`, `@types/jsonwebtoken`, ...

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
- Login token deta hai, `/me` us token se current user nikaalta hai
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
