# Auth + User — Interview Questions with Answers

> Har section [auth-explained.md](auth-explained.md) ke ek hisse se juda hai.
> Difficulty: 🟢 basic · 🟡 medium · 🔴 advanced / senior-level
>
> **Tip:** Interview mein answer ke baad **"mere project mein maine yeh aise kiya..."** zaroor bolo. Har answer mein `📌 Project link` diya hai — wahi line bolo.

---

## Section 1 — Auth basics

### Q1. 🟢 Authentication aur Authorization mein kya farq hai?
**Ans:**
- **Authentication** = *tum kaun ho?* (login, token verify)
- **Authorization** = *tum yeh kar sakte ho?* (role, ownership check)

Pehle authentication, phir authorization. Fail hone pe: AuthN → **401**, AuthZ → **403**.

📌 Project link: login + `authenticate` middleware authentication karte hain. Authorization abhi sirf "logged in ho ya nahi" tak hai.

### Q2. 🟢 401 aur 403 mein farq?
**Ans:** **401 Unauthorized** = pehchaan nahi hui (token nahi / galat / expired). **403 Forbidden** = pehchaan ho gayi, par permission nahi (jaise normal user admin route khole). Naam confusing hai — 401 asal mein "unauthenticated" hai.

### Q3. 🟡 Session-based auth vs Token-based (JWT) auth?
**Ans:**

| | Session | JWT |
|---|---|---|
| State | server pe (memory/Redis/DB) | token ke andar (stateless) |
| Client ke paas | session ID (cookie) | poora signed token |
| Revoke | turant, session delete | mushkil, expiry tak valid |
| Scale | shared session store chahiye | koi bhi server verify kar sakta hai |

📌 Project link: maine **hybrid** use kiya — access token stateless JWT (fast), refresh token stateful DB mein (revoke ho sake).

### Q4. 🟡 Tumhare project mein auth ke kitne pieces hain, ek line mein flow batao.
**Ans:** Register pe password bcrypt hash hoke DB mein. Login pe bcrypt compare, phir 1-hour JWT access token + 7-day random refresh token (DB mein sha256 hash). Protected routes pe `authenticate` middleware JWT verify karke `req.user` set karti hai. Access expire → `/refresh` pe rotation. Logout → refresh revoke.

---

## Section 2 — Architecture / Layers

### Q5. 🟢 Route, Controller, Service, Repository — har ek ka kaam?
**Ans:**
- **Route** — URL + method ko handler se jodta hai
- **Controller** — HTTP handle: `req` padho, status + response bhejo
- **Service** — business logic (hash, compare, token)
- **Repository** — sirf DB queries

### Q6. 🟡 Service ko `req`/`res` kyun nahi dete?
**Ans:** **Separation of concerns.** Service HTTP se independent rahe toh:
1. unit test asaan (fake `req` banana nahi padta)
2. doosri jagah se reuse (CLI, cron, queue worker)
3. framework badle (Express → Fastify) toh sirf controller badalna

### Q7. 🟡 Repository pattern ka fayda?
**Ans:** Saari SQL ek jagah. Service ko pata nahi data Postgres se aaya ya kahin aur se. DB badle ya query optimize karni ho toh sirf repository chhedo. Testing mein repository mock kar sakte ho.

### Q8. 🟢 `index.ts` aur `app.ts` alag kyun rakhe?
**Ans:** `app.ts` sirf app *banata* hai (`createApp()`), `index.ts` port pe *listen* karta hai. Testing mein (supertest) app import karke bina port khole request bhej sakte ho. Multiple instances bhi bana sakte ho.

### Q9. 🟡 `shared/` folder aur `modules/user/` mein kya farq hai?
**Ans:** `modules/user` = ek feature ka code. `shared/` = jo multiple modules use karein. JWT verify future mein account module ki routes pe bhi lagega, isliye `jwt.ts` shared mein hai. Isko **feature-based / modular structure** kehte hain.

---

## Section 3 — Config, env, DB connection

### Q10. 🟢 Secrets `.env` mein kyun, code mein kyun nahi?
**Ans:** Code git pe jaata hai — secret leak ho jaayega. Har environment (dev/staging/prod) ke alag secrets hote hain. `.env` `.gitignore` mein hai. Production mein env vars platform (AWS Secrets Manager, etc.) se aate hain.

### Q11. 🟡 `getEnv` missing variable pe throw kyun karta hai?
**Ans:** **Fail fast.** Server start pe hi crash ho jaaye toh turant pata chal jaata hai. Warna server chal jaata aur pehli request pe `undefined` secret se JWT sign hota / DB connect fail hota — debug karna mushkil.

📌 Project link: `Number(getEnv("DB_PORT"))` — env values hamesha string hoti hain, isliye convert.

### Q12. 🟡 Connection pool kya hai, kyun use kiya?
**Ans:** Pehle se khule DB connections ka set. Har query pe naya connection = TCP handshake + auth = slow. Pool connection udhaar deta hai, query ke baad wapas. Max connections limit bhi karta hai taaki DB overload na ho.

**Follow-up:** *`pool.query` vs `pool.connect`?* → `pool.query` ek query ke liye khud connection leta-chhodta hai. **Transaction** chahiye (BEGIN…COMMIT) toh `pool.connect()` se ek client lo, kyunki saari queries **same connection** pe honi chahiye.

---

## Section 4 — Middleware & Validation

### Q13. 🟢 Middleware kya hota hai?
**Ans:** Function `(req, res, next)` jo route handler se pehle chalta hai. Ya toh response bhej ke rok de, ya `next()` bula ke aage bhej de. Examples: `express.json()`, `validateBody`, `authenticate`.

### Q14. 🟢 `next()` na bulayein aur response bhi na bhejein toh?
**Ans:** Request **hang** ho jaati hai — client timeout tak wait karta rahega.

### Q15. 🟢 `express.json()` kya karta hai? Hataa dein toh?
**Ans:** JSON request body ko parse karke `req.body` mein object banata hai. Hata do toh `req.body` `undefined` → destructuring pe crash ya validation fail.

### Q16. 🟡 Middleware ka order kyun matter karta hai?
**Ans:** Express upar se neeche chalata hai. `express.json()` routes se **pehle** chahiye, warna body parse nahi hogi. Error middleware **sabse last** chahiye, warna routes ke errors usse tak nahi pahunchenge.

### Q17. 🟡 Server-side validation kyun, frontend pe validation kaafi nahi?
**Ans:** Frontend bypass ho sakta hai — Postman/curl se seedha API hit. **Never trust client input.** Frontend validation UX ke liye, backend validation security ke liye.

### Q18. 🟡 Zod `parse` vs `safeParse`?
**Ans:** `parse` fail pe **throw** karta hai. `safeParse` `{ success: true, data }` ya `{ success: false, error }` return karta hai — try/catch nahi chahiye, flow clean.

📌 Project link: `validateBody` `safeParse` use karta hai aur `error.issues` ko `{ field, message }` list bana ke **400** bhejta hai.

### Q19. 🟡 `req.body = result.data` kyun kiya?
**Ans:** Zod ne data **transform** kiya hai — trim, email lowercase. Aur schema mein na ho aisi extra fields hata di (Zod object default strip karta hai). Controller ko clean data mile, raw nahi.

### Q20. 🟡 `validateBody(schema)` function return kyun karta hai?
**Ans:** **Higher-order function / middleware factory.** Express ko `(req,res,next)` wala function chahiye, par hume schema bhi pass karna hai. Closure se schema yaad rehta hai. Ek code — register, login, kisi bhi schema ke saath reuse.

### Q21. 🔴 Password pe `.trim()` lagana sahi hai?
**Ans:** Nahi. User ka password `" pass word "` jaan-bujh ke spaces ke saath ho sakta hai — trim karne se asli password badal jaata hai aur effective strength kam. Name/email trim theek hai, password **as-is** rakhna chahiye.

📌 Project link: abhi dono schemas mein password trim ho raha hai — consistent hai isliye login chal jaata hai, par best practice nahi. (Improvement list mein hai.)

### Q22. 🟢 Email lowercase kyun kiya?
**Ans:** `A@x.com` aur `a@x.com` duplicate accounts na banein, aur login case-insensitive rahe.

---

## Section 5 — Password hashing (bcrypt)

### Q23. 🟢 Password plain text mein kyun nahi rakhte?
**Ans:** DB leak ho (SQL injection, backup chori, insider) toh saare passwords seedha mil jaayenge — aur log same password doosri sites pe bhi use karte hain.

### Q24. 🟢 Hashing vs Encryption?
**Ans:** **Hashing** one-way hai — wapas nahi aata. **Encryption** two-way — key se decrypt ho sakta hai. Password ko kabhi decrypt karne ki zaroorat nahi, sirf compare — isliye hash. Encryption hoti toh key leak = saare password leak.

### Q25. 🟡 Salt kya hai, kyun zaroori?
**Ans:** Har password ke saath random value mila ke hash. Fayde:
- same password, alag users → **alag hash** (pata nahi chalta kaun same password use kar raha)
- **rainbow tables** bekaar (pre-computed hash list)

bcrypt salt khud generate karke hash string ke andar store karta hai: `$2b$12$<22-char salt><31-char hash>`. Alag column nahi chahiye.

### Q26. 🟡 `bcrypt.hash(password, 12)` mein 12 kya hai?
**Ans:** **Cost factor / salt rounds** — internally 2¹² iterations. +1 karo → time double. 10–12 common hai (~100-300ms). Hardware fast hota jaaye toh cost badhao.

### Q27. 🔴 Password ke liye sha256 kyun nahi, bcrypt kyun?
**Ans:** sha256 **fast** hone ke liye bana hai — GPU pe arabon hash/sec. Leak hue hashes pe brute-force/dictionary attack aasan. bcrypt **jaan-bujh ke slow** hai + tunable cost + built-in salt. Alternatives: **argon2** (latest recommendation, memory-hard), scrypt.

### Q28. 🟡 `bcrypt.compare` kaise kaam karta hai? Kya woh hash decrypt karta hai?
**Ans:** Nahi. Stored hash se **salt aur cost** nikalta hai, diye gaye plain password ko **usi salt + cost** se hash karta hai, aur dono hash compare karta hai (constant-time).

### Q29. 🔴 bcrypt ki koi limitation?
**Ans:** Sirf pehle **72 bytes** use karta hai — uske baad ka password ignore. Isliye max length validation lagao (ya pre-hash). Aur yeh CPU-heavy hai — bahut saare login ek saath → event loop pe load (bcrypt npm async hai, libuv thread pool mein chalta hai, isliye `await` wala version use karo, `hashSync` nahi).

---

## Section 6 — Register flow

### Q30. 🟢 Register ka poora flow batao.
**Ans:** `POST /register` → `validateBody(registerSchema)` (400 on fail) → controller → `registerUser` → `bcrypt.hash(pw, 12)` → `createUser` (INSERT … RETURNING) → **201**. Duplicate email → Postgres `23505` → `AppError(409)` → errorMiddleware → **409**.

### Q31. 🟡 Duplicate email check pehle SELECT se kyun nahi kiya?
**Ans:** **Race condition** — do parallel requests dono SELECT mein "nahi hai" dekh ke dono INSERT kar sakti hain. DB ka **UNIQUE constraint atomic** hai, guarantee wahi deta hai. Isliye insert try karo, `23505` pakdo.

### Q32. 🟢 `23505` kya hai?
**Ans:** PostgreSQL ka error code — **unique_violation**. UNIQUE constraint toota.

### Q33. 🟢 201 kyun, 200 kyun nahi?
**Ans:** **201 Created** = naya resource bana. Semantically sahi status client ko clear signal deta hai.

### Q34. 🔴 Tumhare register mein koi bug/security issue?
**Ans:** Haan — `createUser` `RETURNING` mein `password` bhi leta hai aur controller poora `User` object client ko bhej deta hai. **Password hash response mein leak** hota hai. Hash bhi sensitive hai (offline brute force ho sakta hai). Fix: service `PublicUser` (`id, name, email`) return kare.

> Interview mein apna bug khud batana = **maturity** dikhata hai.

---

## Section 7 — Login flow

### Q35. 🟢 Login ka flow?
**Ans:** Validate → `findUserByEmail` → nahi mila `null` → `bcrypt.compare` → galat `null` → controller **401** → sahi hai toh `createAccessToken` + `issueRefreshToken` (nayi family) → **200** `{ user, accessToken, refreshToken }`.

### Q36. 🟡 "Email not found" aur "Wrong password" alag message kyun nahi?
**Ans:** **User enumeration** — attacker pata kar leta kaunse emails registered hain (phishing, targeted brute force). Generic `"Invalid email or password"` dono cases mein.

### Q37. 🔴 Same message ke bawajood enumeration ho sakti hai?
**Ans:** Haan — **timing attack**. Email nahi mila toh bcrypt chalta hi nahi → response ~5ms. Email mila toh bcrypt → ~250ms. Time naap ke pata chal jaata hai. Fix: user na mile tab bhi ek **dummy hash** se `bcrypt.compare` chalao taaki time barabar ho.

📌 Project link: yeh gap abhi mere code mein hai, fix plan ready hai.

### Q38. 🟡 Brute-force login kaise rokoge?
**Ans:** Rate limiting (per IP + per email, `express-rate-limit` / Redis), failed attempts ke baad temporary lockout ya CAPTCHA, bcrypt ki slowness, 2FA, monitoring/alerts.

### Q39. 🟢 `issueRefreshToken` se pehle `await` kyun?
**Ans:** Woh async hai (DB insert). Bina `await` ke Promise object milta, string nahi, aur insert error pakda nahi jaata (unhandled rejection).

---

## Section 8 — JWT

### Q40. 🟢 JWT kya hai? Structure?
**Ans:** JSON Web Token — `header.payload.signature`, har part Base64URL.
- header: `{ alg: "HS256", typ: "JWT" }`
- payload: claims (`userId`, `iat`, `exp`)
- signature: `HMAC-SHA256(header + "." + payload, secret)`

### Q41. 🟢 Kya JWT encrypted hota hai?
**Ans:** **Nahi** (JWS). Sirf **signed** — koi bhi payload decode karke padh sakta hai. Signature sirf **tampering** rokta hai. Isliye payload mein sensitive data mat daalo. (Encrypted JWT = JWE, alag cheez.)

📌 Project link: payload mein sirf `userId`.

### Q42. 🟡 Signature tampering kaise rokta hai?
**Ans:** Attacker payload mein `userId` badle → server secret se naya signature compute karega → match nahi → reject. Attacker naya valid signature nahi bana sakta kyunki **secret** uske paas nahi.

### Q43. 🟡 HS256 vs RS256?
**Ans:**
- **HS256** — symmetric, ek hi secret sign + verify. Simple, jab ek hi service verify kare.
- **RS256** — asymmetric, **private key** se sign, **public key** se verify. Microservices mein: sirf auth service sign kare, baaki public key se verify karein — secret share nahi karna padta.

📌 Project link: HS256 (jsonwebtoken default), secret `JWT_SECRET` env se.

### Q44. 🟢 `iat` aur `exp` kya hain?
**Ans:** Standard claims. `iat` = issued at (kab bana), `exp` = expiry (Unix seconds). `expiresIn: "1h"` se `exp` khud add hota hai. `jwt.verify` `exp` check karke `TokenExpiredError` deta hai.

### Q45. 🟡 `jwt.verify` ke baad `typeof decoded.userId === "string"` check kyun?
**Ans:** `jwt.verify` ka return type `string | JwtPayload` hai — TypeScript ko guarantee nahi. Runtime pe bhi confirm karna chahiye ki payload expected shape ka hai (koi aur service ka same-secret token, ya purana format). **Never trust, always validate** — token ke andar ka data bhi.

### Q46. 🟡 JWT ko "stateless" kyun kehte hain? Fayda-nuksaan?
**Ans:** Server kuch store nahi karta; token khud proof hai.
- ✅ har request pe DB call nahi → fast, horizontal scale easy
- ❌ **revoke nahi ho sakta** — chori/logout ke baad bhi expiry tak valid

### Q47. 🔴 JWT ko expiry se pehle invalidate kaise karoge?
**Ans:**
1. **Short expiry** + refresh token (mera approach)
2. **Blacklist/denylist** — token ka `jti` Redis mein, TTL = remaining expiry; har request pe check
3. **Token version** — user table mein `token_version`, JWT mein bhi; logout-all pe version++ → purane mismatch
4. Secret rotate (sab ke tokens band — nuclear option)

### Q48. 🔴 JWT se related koi known attacks?
**Ans:**
- **`alg: none`** — unsigned token accept karna (modern libraries default block karti hain)
- **Algorithm confusion** — RS256 public key ko HS256 secret ki tarah use karwana. Bachav: `jwt.verify(token, secret, { algorithms: ["HS256"] })` explicitly
- **Weak secret** — brute force ho sakta hai; lamba random secret (≥256 bit)
- **Token theft via XSS** — localStorage mein rakha toh

📌 Project link: abhi `algorithms` explicitly nahi diya — improvement list mein.

### Q49. 🟡 Access token kahan store karna chahiye (frontend)?
**Ans:**
- **localStorage** — XSS se chori ho sakta hai
- **Memory (JS variable)** — safest for access token, page refresh pe gaya → refresh token se naya lo
- **httpOnly cookie** — JS nahi padh sakta (XSS safe), par **CSRF** ka dhyaan (SameSite, CSRF token)

Common best practice: access token memory mein, refresh token **httpOnly + Secure + SameSite=Strict** cookie mein.

📌 Project link: abhi dono JSON mein hain, frontend decide karega — cookie move planned.

---

## Section 9 — `authenticate` middleware

### Q50. 🟢 `Authorization: Bearer <token>` — Bearer kya hai?
**Ans:** Auth scheme ka naam (RFC 6750). "Jiske paas yeh token hai (bearer), use access do." Token hi proof hai — isliye HTTPS zaroori.

### Q51. 🟢 `slice(7)` kyun?
**Ans:** `"Bearer "` = 7 characters (space ke saath). Uske baad token. `.trim()` extra spaces hata deta hai. Pehle `startsWith("Bearer ")` check hota hai.

### Q52. 🟡 `req.user` TypeScript mein error kyun nahi deta?
**Ans:** `src/types/express.d.ts` mein **declaration merging**: `declare global { namespace Express { interface Request { user?: AuthUser } } }`. Express ke Request interface mein property jod di. `?` optional kyunki public routes pe set nahi hota.

### Q53. 🟡 Middleware DB se poora user kyun nahi laati?
**Ans:** Har protected request pe DB call = slow. JWT mein `userId` kaafi hai. Jis route ko name/email chahiye (`/me`) woh khud DB se laaye. Trade-off: user delete ho gaya toh bhi token 1h chalega — `/me` usko **404** se handle karta hai.

### Q54. 🟢 `/me` endpoint password kyun nahi deta?
**Ans:** Repository query hi `SELECT id, name, email` hai — password select hi nahi hota. **Least data principle**: jo chahiye sirf wahi nikaalo.

---

## Section 10 — Refresh tokens

### Q55. 🟢 Refresh token kyun chahiye?
**Ans:** Access token short (1h) rakhna hai security ke liye, par har ghante login bad UX. Refresh token (7d) se chupchaap naya access token mil jaata hai. Aur refresh DB mein hai → **revoke** ho sakta hai.

### Q56. 🟡 Access vs Refresh token — comparison?
**Ans:**

| | Access | Refresh |
|---|---|---|
| Format | JWT | opaque random (64 hex) |
| Life | 1h | 7d |
| Bheja jaata | har request | sirf `/refresh`, `/logout` |
| Storage server pe | nahi | sha256 hash |
| Revocable | nahi | haan |

### Q57. 🟡 Refresh token JWT kyun nahi banaya, random string kyun?
**Ans:** Refresh ko waise bhi DB mein check karna hai (revoke/rotation ke liye), toh self-contained JWT ka fayda nahi. Random **opaque** token simple hai, koi info leak nahi karta, aur 256-bit entropy se guess impossible.

### Q58. 🟡 `crypto.randomBytes` vs `Math.random`?
**Ans:** `randomBytes` = **CSPRNG** (OS entropy, unpredictable). `Math.random` predictable PRNG — security tokens ke liye kabhi nahi.

### Q59. 🟡 Refresh token DB mein hash karke kyun rakha?
**Ans:** DB leak hua toh raw tokens nahi milenge. Hash se token nahi banta, aur API raw token maangti hai. Password jaisa hi logic — secret kabhi plain store mat karo.

### Q60. 🔴 Refresh token ke liye sha256 kyun, bcrypt kyun nahi?
**Ans:** Do reasons:
1. Token already **256-bit random** — brute force impossible, slow hash ki zaroorat nahi
2. **Lookup chahiye** — `WHERE token_hash = $1`. sha256 **deterministic** (same input → same hash). bcrypt random salt lagata hai → har baar alag hash → DB mein dhoondh hi nahi sakte

Rule: **low-entropy secret (password) → slow hash. High-entropy secret (token) → fast hash.**

### Q61. 🟡 `token_hash` pe UNIQUE kyun?
**Ans:** Do rows same hash ki na hon (lookup ek row de). Aur UNIQUE constraint automatically **index** banata hai → lookup fast.

---

## Section 11 — Rotation, Family, Reuse detection

### Q62. 🟡 Refresh token rotation kya hai?
**Ans:** Har `/refresh` call pe purana refresh revoke, **naya refresh** issue. Har refresh token **one-time use**. Chori hua token jaldi bekaar ho jaata hai.

### Q63. 🔴 Reuse detection kaise kaam karta hai?
**Ans:** Revoked token dubara aaye → matlab token do jagah hai (legit user + attacker). Server nahi jaanta kaun asli hai → us token ki **poori family revoke** → `401 "Refresh token reuse detected"`. Dono ko dobara login karna padega; attacker ke paas password nahi.

### Q64. 🔴 Token family kya hai, kyun chahiye?
**Ans:** Ek login se shuru hui saari refresh tokens ki chain — same `token_family_id` (login pe `randomUUID()`, rotation pe wahi pass). Reuse pe sirf ek token band karna kaafi nahi, kyunki attacker ke paas latest wala bhi ho sakta hai. Family revoke = poora session band. Doosre devices (alag family) safe rehte hain.

### Q65. 🔴 Ek scenario samjhao: attacker ne R1 chura liya.
**Ans:**
- **Case A — user pehle use kare:** user R1 → R2 mila, R1 revoked. Attacker R1 bheje → revoked → family F1 revoke (R2 bhi). Attacker bahar, user ko relogin.
- **Case B — attacker pehle use kare:** attacker R1 → R2 attacker ke paas. User R1 bheje → revoked → family revoke → attacker ka R2 bhi band. 

Dono cases mein chain toot jaati hai. Kamzori: jab tak koi reuse na kare, attacker ~access window tak chala sakta hai.

### Q66. 🟡 Revoked token ko delete kyun nahi karte, `revoked_at` kyun?
**Ans:** **Soft revoke.** Delete kar dete toh reuse pe row "nahi mili" → normal invalid lagta, **reuse detect hi nahi hota**, family revoke nahi hoti. Plus audit trail milta hai.

### Q67. 🟡 Service mein ek case `return null` aur ek case `throw` kyun?
**Ans:** Invalid/expired → normal "nahi chala" → `null` → controller 401. Reuse → special security event, alag message + side-effect (family revoke) → custom `RefreshTokenReuseError` throw → controller `instanceof` se pehchanta hai. `null` do alag situations distinguish nahi kar sakta.

### Q68. 🟡 Order kyun: pehle revoked check, phir expiry?
**Ans:** Revoked + expired token bhi reuse hai — agar pehle expiry check karte toh chup-chaap `null` ho jaata aur chori detect nahi hoti. Security event ko priority.

### Q69. 🔴 Tumhare refresh flow mein koi concurrency bug?
**Ans:** Haan — **race condition**. `findRefreshTokenByHash` aur `revokeRefreshToken` alag queries hain. Same token se do requests *ek saath* → dono ko `revokedAt = null` dikhta → dono naye tokens issue. `revokeRefreshToken` `rowCount === 1` return karta hai, par service check nahi karti.

Fix options:
1. `const ok = await revokeRefreshToken(hash); if (!ok) → reuse/invalid` — `UPDATE … WHERE revoked_at IS NULL` atomic hai, sirf ek jeetega
2. Transaction + `SELECT … FOR UPDATE` (row lock)

**Follow-up:** *Frontend mein multiple tabs ek saath refresh karein toh?* → legit user pe bhi reuse trigger ho sakta hai. Solution: frontend mein ek hi refresh request (lock/queue), ya server pe chhota **grace period**.

### Q70. 🟡 Refresh pe naya access token ke saath user ka existence check kyun nahi?
**Ans:** `user_id` FK `ON DELETE CASCADE` hai — user delete hua toh uske refresh tokens bhi DB se gaye, lookup `null` dega. Isliye alag check ki zaroorat nahi.

---

## Section 12 — Logout

### Q71. 🟢 Logout kaise implement kiya?
**Ans:** Body mein refresh token → sha256 → `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL` → **204**.

### Q72. 🟡 Logout hamesha 204 kyun, token galat ho tab bhi?
**Ans:** **Idempotent** — kitni baar bhi logout karo, final state "logged out". Aur attacker ko yeh signal nahi milta ki token valid tha ya nahi.

### Q73. 🔴 Logout ke baad access token ka kya?
**Ans:** Stateless JWT hai — expiry (≤1h) tak chalega. Refresh band hai toh naya nahi milega. Turant band karna ho toh `jti` blacklist (Redis) ya bahut short expiry (5-15 min). Client side token delete karna zaroori.

### Q74. 🟡 "Logout from all devices" kaise banaoge?
**Ans:** `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`. Access tokens ke liye `token_version` approach (Q47).

### Q75. 🟡 204 ke saath body kyun nahi?
**Ans:** **204 No Content** ka matlab hi hai body nahi. `res.status(204).send()` — body bhejo bhi toh HTTP spec ke hisaab se ignore.

---

## Section 13 — Error handling

### Q76. 🟢 Custom error class kyun banayi (`AppError`)?
**Ans:** Normal `Error` mein status code nahi hota. `AppError(statusCode, message)` se service bol sakti hai "yeh 409 hai" bina `res` jaane. Error middleware `instanceof AppError` se pehchanta hai.

### Q77. 🟢 `super(message)` aur `this.name` kya karte hain?
**Ans:** `super` parent `Error` ka constructor chalata hai → `message` + stack trace set. `this.name` logs mein class ka naam dikhata hai (`AppError: Email is already registered`).

### Q78. 🟡 `constructor(public statusCode: number, ...)` — `public` kya kar raha hai?
**Ans:** TypeScript **parameter property** — class field declare + `this.statusCode = statusCode` assign, ek line mein.

### Q79. 🟡 Express error middleware ko kaise pehchanta hai?
**Ans:** **4 parameters** `(err, req, res, next)`. Express function ki `length` (arity) dekhta hai. `next` use na ho tab bhi likhna padta hai.

### Q80. 🟡 Error middleware sabse last kyun?
**Ans:** Express order mein chalta hai; error aane pe aage ke **error handlers** dhoondhta hai. Routes ke baad hoga tabhi unke errors pakdega.

### Q81. 🟡 Unknown error pe client ko asli message kyun nahi bhejte?
**Ans:** Stack trace, SQL, table names = **information disclosure** — attacker ke kaam ki cheez. Client ko generic `"Internal server error"`, detail server logs (`console.error`) mein.

### Q82. 🔴 Async controller mein error `throw` hua — errorMiddleware tak kaise pahuncha, try/catch toh nahi?
**Ans:** **Express 5** rejected promises ko khud `next(err)` pe forward karta hai. Express 4 mein yeh nahi tha — `try/catch` + `next(err)` ya `express-async-errors` package chahiye tha, warna unhandled rejection + hanging request.

### Q83. 🟡 `RefreshTokenReuseError` ko `AppError` se extend karte toh kya fayda?
**Ans:** `class RefreshTokenReuseError extends AppError { constructor(){ super(401, "Refresh token reuse detected") } }` → controller ka try/catch hata sakte, errorMiddleware khud 401 bhejta. Consistent error handling.

### Q84. 🟡 `catch (error: unknown)` mein `"code" in error` check kyun?
**Ans:** TypeScript strict mode mein caught error `unknown` hai — kuch bhi throw ho sakta hai (string, number). `typeof error === "object" && error !== null && "code" in error` se **type narrowing** — safely `error.code` padh sakte ho.

---

## Section 14 — Database, SQL, migrations

### Q85. 🟢 SQL injection kya hai, kaise bache?
**Ans:** User input SQL string mein chipak ke query ka matlab badal de (`' OR 1=1 --`). Bachav: **parameterized queries** — `$1, $2` placeholders, values alag array mein. DB value ko sirf **data** maanta hai, code nahi.

📌 Project link: saari repository queries `$1` style.

### Q86. 🟢 `RETURNING` kya karta hai?
**Ans:** INSERT/UPDATE ke baad affected row wapas deta hai — alag SELECT query ki zaroorat nahi (ek round trip bacha, aur race bhi nahi).

### Q87. 🟢 `created_at AS "createdAt"` kyun?
**Ans:** Postgres convention `snake_case`, JavaScript `camelCase`. Alias se mapping query mein hi. Double quotes zaroori — warna Postgres lowercase kar deta (`createdat`).

### Q88. 🟡 `ON DELETE CASCADE` kya hai?
**Ans:** Parent (`users`) row delete → child (`refresh_tokens`) rows automatically delete. Orphan tokens nahi bachte.

### Q89. 🟢 Migration kya hai, kyun?
**Ans:** DB schema ka **version control**. Har change numbered file, har environment mein same order mein chalta hai. Team mein sabka schema same, history traceable. Tool: `node-pg-migrate`.

### Q90. 🟡 Migration 001 khali kyun hai?
**Ans:** `users` table migrations system se pehle manually bani thi. 001 = **baseline** — history ka starting point. Improvement: `CREATE TABLE IF NOT EXISTS users …` likhna taaki naye environment mein bhi ban jaaye.

### Q91. 🔴 Migration 003 mein seedha `ADD COLUMN … NOT NULL` kyun nahi?
**Ans:** Table mein purani rows hain — unki value NULL hogi → constraint fail. Safe pattern: (1) nullable add, (2) purani rows **backfill** (`gen_random_uuid()`), (3) phir `SET NOT NULL`. Production mein **zero-downtime migrations** ka yahi idea hai.

### Q92. 🟡 `TIMESTAMPTZ` kyun, `TIMESTAMP` kyun nahi?
**Ans:** TZ wala UTC mein store karta hai, timezone-aware. Server/DB alag timezone mein hon toh bhi `expires_at <= NOW()` sahi.

### Q93. 🟡 Expired/revoked tokens ka table mein kya hoga?
**Ans:** Abhi jama hote rahenge. Cleanup job (cron): `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days'` — thoda buffer rakho taaki recent reuse detect ho sake.

### Q94. 🟡 Index kahan chahiye?
**Ans:** `users.email` (UNIQUE → index), `refresh_tokens.token_hash` (UNIQUE → index). **`token_family_id` pe index nahi** — family revoke query slow ho sakti hai bade table pe. `user_id` pe bhi index lagana chahiye (logout-all, CASCADE delete).

---

## Section 15 — TypeScript & Node

### Q95. 🟢 `User` aur `PublicUser` alag types kyun?
**Ans:** `User` mein password hash hai (sirf internal). `PublicUser` = jo client ko jaata hai. Type system galti se password bhejne ko rokta hai. Idea **DTO** (Data Transfer Object) ka hai.

### Q96. 🟡 Import mein `.js` kyun likha jab file `.ts` hai?
**Ans:** `"type": "module"` + `"module": "NodeNext"`. Node ESM mein extension zaroori hai, aur runtime pe compiled `.js` file hi hogi. TypeScript import path rewrite nahi karta, isliye source mein hi `.js`.

### Q97. 🟢 `dependencies` vs `devDependencies`?
**Ans:** `dependencies` — runtime pe chahiye (express, pg, bcrypt, jsonwebtoken, zod). `devDependencies` — sirf development/build (typescript, tsx, `@types/*`). Production install `npm ci --omit=dev`.

### Q98. 🟢 `??` vs `||`?
**Ans:** `??` sirf `null`/`undefined` pe right side leta hai. `||` saare falsy (`""`, `0`, `false`) pe. `tokenFamilyId ?? crypto.randomUUID()` — undefined ho tabhi nayi family.

### Q99. 🟡 `strict: true` kya karta hai?
**Ans:** Saare strict checks on — `strictNullChecks` (null/undefined ka dhyaan), `noImplicitAny`, catch variable `unknown`, etc. Bugs compile time pe.

---

## Section 16 — Security design (senior-level open questions)

### Q100. 🔴 Tumhare auth system ko production-ready banane ke liye kya add karoge?
**Ans:** (priority order)
1. Register response se password hash hatana
2. Refresh race condition fix (atomic revoke check)
3. Rate limiting + lockout on `/login`, `/refresh`
4. Refresh token → httpOnly Secure SameSite cookie
5. `jwt.verify` mein `algorithms: ["HS256"]`
6. Password: trim hatana, max length (bcrypt 72), strength rules
7. `helmet`, CORS whitelist, HTTPS only
8. Token cleanup cron, `token_family_id` + `user_id` index
9. Audit logging (login fail, reuse detected → alert)
10. Tests (unit + supertest integration)
11. Email verification, password reset, 2FA

### Q101. 🔴 CSRF kya hai? Tumhare project pe lagta hai?
**Ans:** Browser automatically cookies bhejta hai → malicious site user ke naam pe request karwa de. Abhi tokens **header/body** mein hain (cookie nahi) → CSRF risk nahi. Refresh ko cookie mein le gaye toh `SameSite=Strict/Lax` + CSRF token chahiye.

### Q102. 🔴 XSS se tokens kaise bachaoge?
**Ans:** XSS mein attacker ka JS chalta hai — localStorage/JS memory padh sakta hai. httpOnly cookie JS se nahi padhi ja sakti. Plus: output escaping, CSP header, input sanitize.

### Q103. 🔴 Horizontal scaling (multiple servers) mein tumhara auth chalega?
**Ans:** Haan. Access token stateless — koi bhi server `JWT_SECRET` se verify kar lega (sab servers pe same secret). Refresh tokens shared Postgres mein → sab servers dekh sakte. Sticky sessions ki zaroorat nahi.

### Q104. 🔴 JWT_SECRET leak ho gaya toh?
**Ans:** Attacker kisi bhi `userId` ka valid access token bana sakta hai. Turant: secret rotate (sab access tokens invalid, users refresh se naya lenge — refresh tokens alag hain, par unhe bhi revoke karna safer), incident investigation. Prevention: secret manager, key rotation with `kid` header, RS256 (private key sirf auth service ke paas).

### Q105. 🟡 HTTPS kyun zaroori hai bearer tokens ke saath?
**Ans:** HTTP plain text hai — network pe koi bhi (wifi, proxy) header padh ke token chura sakta hai (**man-in-the-middle**). Bearer token = jiske paas, uska access. HTTPS encrypt karta hai.

---

## Quick revision — 15 one-liners interview se pehle

1. **AuthN = kaun ho (401), AuthZ = kya kar sakte ho (403)**
2. **Password → bcrypt (slow + salt), kabhi encrypt nahi**
3. **Cost 12 = 2¹² rounds, +1 = double time**
4. **JWT = header.payload.signature, signed hai encrypted nahi**
5. **Payload mein sirf `userId`**
6. **Access 1h stateless, Refresh 7d stateful (DB mein hash)**
7. **Refresh ka sha256 isliye kyunki high entropy + lookup chahiye**
8. **Rotation = har refresh pe naya refresh, purana band**
9. **Revoked token dubara aaya = reuse → poori family revoke**
10. **Soft revoke (`revoked_at`) ke bina reuse detection possible nahi**
11. **Same login error message → user enumeration se bachav**
12. **Duplicate email → DB UNIQUE + `23505` → 409 (race-safe)**
13. **`$1` parameterized queries → SQL injection se bachav**
14. **Error middleware = 4 params, sabse last; Express 5 async errors khud forward**
15. **Mere code ke known gaps: register hash leak, refresh race, timing attack, no rate limit**
