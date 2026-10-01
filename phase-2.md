# Phase 2 — Account

Phase 1 mein user banta hai aur login karta hai. Paisa rakhne ki jagah abhi nahi thi.

User ko paise rakhne hain, isliye **account** chahiye. Account us user ki ek jeb hai: kis type ki hai, kis currency mein hai, aur uska number kya hai.

Abhi account **khali jeb** hai. Balance, deposit, transfer is phase mein nahi. Woh baad ka kaam hai. Yahan sirf jeb banana aur dekhna hai.

Flow wahi hai jo phase 1 mein tha:

```
CLIENT
  → ROUTE              /api/v1/accounts
  → MIDDLEWARE         authenticate, POST pe Zod bhi
  → CONTROLLER         req lo, res do
  → SERVICE            userId + account data aage bhejo
  → REPOSITORY         SQL
  → POSTGRES
  → response wapas controller se client ko
```

Server wahi hai: `npm run dev` → port **3000**.  
Prefix: `/api/v1/accounts`. Path `accounts` hai, `account` nahi.

`userId` URL ya body mein nahi aata. Login ke access token se aata hai. `authenticate` token check karke `req.user = { userId }` laga deti hai. Isliye koi doosre user ka account nahi bana sakta aur nahi dekh sakta.

---

## 1. Account kis liye hai

Ek user ke **kai** account ho sakte hain. Isliye list ek array hai, ek object nahi.

Abhi type sirf do:

| Type | Matlab |
|---|---|
| `SAVINGS` | bachat wala account |
| `CHECKING` | roz chalne wala account |

Postgres `CHECK` bhi yahi do maanta hai. Zod bhi yahi do maanta hai. Teesra type bhejoge → **400**, DB tak request nahi jaati.

Status abhi client nahi bhejta. Naya account hamesha `ACTIVE` banta hai. Baaki do DB mein allowed hain, abhi koi API unhe set nahi karti:

| Status | Matlab |
|---|---|
| `ACTIVE` | chal raha hai. Default |
| `SUSPENDED` | rukka hua |
| `CLOSED` | band |

Currency client bhejta hai: 3 letters, jaise `inr`. Zod trim karke uppercase kar deta hai, DB mein `INR` jaata hai.

---

## 2. Do alag cheezein — `id` aur `accountNumber`

Dono account ko pehchanti hain. Kaam alag hai.

| | `id` | `accountNumber` |
|---|---|---|
| Kis ke liye | **internal**. Server, DB, JWT ke baad ki query | **public**. Jo number log dekhte aur dete hain |
| DB type | `UUID` | `VARCHAR(20)`, UNIQUE |
| Kaun banata hai | Postgres, `gen_random_uuid()` | sequence `account_number_seq`, start `100000000001` |
| Example | `a3f2...-....` jaisa UUID | `100000000003` |
| URL mein | `GET /api/v1/accounts/:accountId` **yahi** maangta hai | is URL mein mat bhejo |

`id` customer ko account number ki tarah nahi dikhana. Woh row ki primary key hai. Doosri table baad mein isi `id` se judengi (`user_id` bhi isi tarah users ki `id` hai).

`accountNumber` woh number hai jo insaan padh sake. Sequence khud badhti hai: pehla account `100000000001`, agla `100000000002`. Client yeh number nahi bhejta. `INSERT` mein `account_number` column hai hi nahi — DB default laga deti hai.

**Postman wali 500 isi farq ki wajah se thi.**

`GET /api/v1/accounts/100000000003`

`100000000003` account number hai. Route use `id` samajh kar query karti hai:

```sql
WHERE id = $1 AND user_id = $2
```

`id` UUID hai. Postgres number ko UUID nahi bana pata:

```text
invalid input syntax for type uuid: "100000000003"
```

Yeh `AppError` nahi hai, isliye error middleware **500** `"Internal server error"` bhejti hai. Token theek tha. Request repository tak pahunchi thi.

Sahi call: pehle `GET /api/v1/accounts`, response se `id` (UUID) copy karo, phir

```text
GET /api/v1/accounts/<woh-uuid>
```

`accountNumber` response mein dikhta hai, taaki client use dikha sake. Dhoondhne ke liye abhi API `id` use karti hai.

---

## 3. Table

`migrations/004_create_accounts.sql` aur `005_add_account_number_sequence.sql`.

```text
accounts
  id              UUID          PK, default gen_random_uuid()
  user_id         UUID          NOT NULL, users(id), ON DELETE RESTRICT
  account_number  VARCHAR(20)   NOT NULL UNIQUE, default sequence
  type            VARCHAR(20)   SAVINGS | CHECKING
  currency        VARCHAR(3)    NOT NULL
  status          VARCHAR(20)   ACTIVE | SUSPENDED | CLOSED, default ACTIVE
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
```

Index: `idx_accounts_user_id` on `user_id`. Ek user ke saare account nikalne ke liye.

`ON DELETE RESTRICT`: user tab delete nahi ho sakta jab tak uska account hai. Account pehle, user baad mein.

JavaScript type `Account` (`account.types.ts`): `id`, `userId`, `accountNumber`, `type`, `currency`, `status`, `createdAt`, `updatedAt`.

DB snake_case hai. Query alias karti hai: `user_id AS "userId"`, `account_number AS "accountNumber"`.

`$1, $2` placeholder hain. Value query string mein nahi chipakti.

---

## 4. Teen API

Teenon pe `authenticate` lagti hai. Bina `Authorization: Bearer <accessToken>` ke **401**.

| # | Method | Path | Kaam |
|---|---|---|---|
| 1 | POST | `/api/v1/accounts` | is user ka naya account. userId token se |
| 2 | GET | `/api/v1/accounts` | is user ke saare account. userId token se |
| 3 | GET | `/api/v1/accounts/:accountId` | is user ka **ek** account. `accountId` = UUID `id` |

### 1. POST — user ke liye account banao

Body sirf yeh:

```json
{ "type": "SAVINGS", "currency": "inr" }
```

`userId` body mein mat bhejo. Token se aata hai.

1. `authenticate` → `req.user.userId`
2. `validateBody(createAccountSchema)` — type enum, currency 3 letters uppercase
3. Controller `createUserAccount(userId, type, currency)`
4. Service repository `createAccount` ko de deti hai. Abhi service mein extra rule nahi
5. `INSERT ... RETURNING`. `account_number` DB khud deti hai
6. **201** `{ account, message: "Account created successfully" }`

### 2. GET — user id se uske account

Body nahi. Path mein user id nahi.

1. `authenticate`
2. `getUserAccounts(req.user.userId)`
3. `WHERE user_id = $1 ORDER BY created_at DESC` — naya pehle
4. **200** `{ accounts: [...] }`
5. Koi account nahi → **200** aur `accounts: []`. 404 nahi. User hai, list khali hai

### 3. GET — account id se ek account

Path: UUID `id`. Account number nahi.

1. `authenticate`
2. `getUserAccount(req.params.accountId, req.user.userId)`
3. SQL **dono** check karti hai: `id` match **aur** `user_id` match
4. Mile → **200** `{ account }`
5. Na mile, ya doosre user ka UUID ho → **404** `"Account not found"`. Doosre ka account hai ya nahi, yeh response nahi batata
6. Path mein UUID nahi (jaise account number) → Postgres error → **500**. Abhi iske liye 400 validation nahi hai

---

## 5. Files

| File | Kaam |
|---|---|
| `account.routes.ts` | teen routes, middleware ka order |
| `account.validation.ts` | POST ki Zod schema |
| `account.controller.ts` | status + JSON. DB nahi |
| `account.service.ts` | controller aur repository ke beech. Abhi seedha pass-through |
| `account.repository.ts` | `INSERT` aur `SELECT` |
| `account.types.ts` | `Account`, `AccountType`, `AccountStatus` |
| `src/app.ts` | `app.use("/api/v1/accounts", accountRouter)` |
| `migrations/004`, `005` | table aur account number sequence |

Route order matter karta hai, lekin yahan clash nahi: `GET /` list hai, `GET /:accountId` ek account hai. Express pehle exact `/` dekhta hai.

Controller `try/catch` mein `next(error)` karti hai. User module ke register/login aksar seedha `res` bhejte hain. Account module unknown error ko `errorMiddleware` tak pahunchata hai. `AppError` ho to uska status, warna **500**.

`req.user` missing ho (middleware ke bina call ho) → controller **401** `"Unauthorized"`. Normal route pe `authenticate` pehle hi rok deti hai.

---

## 6. Function — `export async function` kyun, aur aur kaunse tareeke hain

JavaScript mein function **ek** cheez hai: code ka hissa jise naam dekar call kar sakte ho. Likhne ke kai tareeke hain. Kaam same ho sakta hai. Farq naam, `this`, aur stack trace mein hai.

Is project ki controller, service, repository **function declaration** hain:

```ts
export async function getUserAccount(
    accountId: string,
    userId: string
): Promise<Account | null> {
    return await findAccountById(accountId, userId);
}
```

- **`function`** — declaration. Naam `getUserAccount` function ka apna naam hai
- **`async`** — andar `await` hai, kyunki DB ka jawab wait karna hai. Function Promise return karti hai. `Promise<Account | null>` wahi batata hai
- **`export`** — doosri file `import { getUserAccount }` kar sake. Bina export ke function usi file mein rehti hai

`await` ke bina `async` ki zaroorat nahi. `authenticate` DB wait nahi karti, isliye woh `export function authenticate` hai, `async` nahi. Account ki teen layer DB tak jaati hain, isliye teeno `async` hain.

Terminal ki error mein naam isliye dikhe:

```text
at async findAccountById (account.repository.ts:62:20)
at async getUserAccount (account.service.ts:29:12)
at async getAccountController (account.controller.ts:72:25)
```

Arrow function ka naam aksar stack mein nahi aata, ya `(anonymous)` dikhta hai. Debugging mein declaration saaf hoti hai.

### Jo tareeke JS / TS mein hote hain

**1. Function declaration** — yahi project ka default hai

```ts
export async function createAccountController(...) { ... }
```

Naam hota hai. File ke andar declaration upar use ho sakti hai, neeche likhi ho tab bhi (hoisting). Export karke doosri file le jaate hain.

**2. Function expression** — function ek variable mein

```ts
const createAccountController = async function (...) { ... };
export { createAccountController };
```

Kaam wahi. Naam variable ka hai, function ka optional. `const` hoist nahi hoti: use se pehle line pe call nahi kar sakte.

**3. Arrow function** — `function` keyword nahi, `=>`

```ts
const createAccountController = async (...) => { ... };
```

Chhoti cheez ke liye. Apna `this` nahi banati. Is repo mein jahan function **ek baar, usi jagah** chahiye:

```ts
app.get("/", (req, res) => {
    res.json("welcome to the fincore api");
});
```

```ts
userRouter.get("/protected", authenticate, (req, res) => {
    res.json({ message: "You have accessed a protected route!", userId: req.user?.userId });
});
```

`validateBody` declaration hai, andar jo return hota hai woh arrow hai — Express usi ko middleware maanta hai.

Arrow se `export const x = async () => {}` **chalega**. Hum controller pe declaration isliye rakhte hain: naam stack mein aaye, aur phase 1 ki files jaisa ek hi style rahe.

**4. Method** — object ya class ke andar

```ts
export class AppError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = "AppError";
    }
}
```

`constructor` tab chalta hai jab `new AppError(409, "...")` likhte ho. Class ke andar aur functions `method` kehlate hain. Account module mein class nahi hai.

**5. Callback** — function jo doosre function ko argument mein dete ho

Express route ka last hissa yahi hai. `router.get("/:accountId", authenticate, getAccountController)` — `authenticate` aur `getAccountController` dono callbacks hain jo Express baad mein call karta hai. Alag type ki language nahi, bas use ka tarika.

**6. `async` alag type nahi hai.** Declaration, expression, ya arrow teeno pe lag sakta hai. Matlab sirf: yeh function Promise deti hai, andar `await` likh sakte ho.

**7. Generator — `function*`.** Ruk ruk kar value deti hai (`yield`). Is project mein kahin nahi.

**8. IIFE** — turant call hone wali function, `(function () { ... })()`. Is project mein nahi. Purane code mein scope banane ke liye hoti thi.

Is repo mein asal mein teen style hain: **declaration** (controller, service, repository, middleware), **arrow** (chhota inline route ya middleware ke andar), **class constructor** (`AppError`). Baaki tareeke language mein hain, yahan kaam nahi aa rahe.

`export default router` alag hai. Default export ek cheez hoti hai, import pe naam koi bhi rakh sakte ho (`accountRouter`). Named export (`export async function ...`) ka naam import pe wahi rehta hai.

---

## Status codes

| Code | Kab |
|---|---|
| 200 | list, ya ek account mil gaya |
| 201 | account ban gaya |
| 400 | POST body galat: type `SAVINGS`/`CHECKING` nahi, ya currency 3 letters nahi |
| 401 | token nahi, token galat, ya `req.user` nahi |
| 404 | UUID to hai, par is user ka woh account nahi |
| 500 | DB error. UUID ki jagah account number bhejna abhi yahin aata hai |

---

## Is phase mein nahi hai

1. **Balance nahi.** Account mein paise ka column nahi. Deposit / withdraw / transfer nahi.
2. **Account number se dhoondhne ki API nahi.** Number public hai, lookup abhi `id` se hai.
3. **Status change nahi.** Sab `ACTIVE` bante hain. Suspend / close ka route nahi.
4. **Galat `accountId` pe 400 nahi.** UUID na ho to Postgres 500 deta hai.
5. **Service abhi rule nahi lagati.** Woh repository ko forward karti hai. Limit (ek user ke kitne SAVINGS) baad mein yahin aayegi, controller mein nahi.

---Transaction: Records what business event happened — e.g., Ruchi sent ₹1 to you.
---Ledger: Records the financial effect of that event — Ruchi DEBIT ₹1, you CREDIT ₹1.
---PostgreSQL transaction, ye ik postgres ka concept h, as like in mongo, mongodb aggreation pipeline.
---aapko agar kahi bhi atomic ya atomicity dikhe tho iska mtlb hota h
single unit, ya tho complete hoga ya hoga hi nhi
suppose money distribute krni 10 people me, 4 me hogyi 5th me error aagya, so, behavior aaisa krnah hi ya tho sabhi ki successfull ho ya 1 ki bhi nhi, so 5th p error aane p, phle 4 bhi revert back ho jaieyege
ya tho sabhi ya kuch bhi nhi, treat all as a single unit
so it includes commit rollback if  money distribute to 10 then commit if failed in between then rollback and it will handle in database.ts


repositories should use the same PostgreSQL client when they are part of a transaction.

Right now your repository does this:

pool.query(...)

But our withTransaction() gives us:

client
We need the repository to accept that client.

const db =client?? pool;==>
If client is provided
        ↓
use client.query()
        ↓
part of PostgreSQL transaction
Otherwise:

No client
   ↓
use pool.query()
   ↓
normal standalone query

## Ledger
Records the financial effect of that event — Ruchi DEBIT ₹1, you CREDIT ₹1.

## PostgreSQL transaction
Ye ek Postgres ka concept hai, jaise MongoDB mein aggregation pipeline.


ACID:
Atomicity ka matlab: All or Nothing
Consistency ka matlab: Transaction ke baad database valid state mein rehna chahiye.

## Atomicity
Agar kahin **atomic** ya **atomicity** dikhe, iska matlab hai **single unit**: ya to complete hoga, ya hoga hi nahi.

Suppose money distribute karni hai 10 people mein. 4 mein ho gayi, 5th mein error aa gaya. Behavior aisa hona chahiye: ya to sabhi successful hon, ya ek ki bhi nahi. 5th pe error aane pe pehli 4 bhi revert back ho jayengi.
Ya to sabhi, ya kuch bhi nahi. Treat all as a single unit.
Isme **commit** aur **rollback** aata hai. 10 ko money distribute ho gayi to commit. Beech mein fail hua to rollback. Yeh `database.ts` mein handle hoga.



## Repository aur same client



Repositories should use the same PostgreSQL client when they are part of a transaction.



Right now the repository does this:



```ts



pool.query(...)



```



## Aaj kya kiya



- `transactions` table (migration 006) aur `ledger_entries` table (migration 007).



- `accounts` pe `balance` column, default `0` (migration 008). `npm run migrate -- up` chal chuka hai.



- Transaction module: types, `createTransaction`, `createPendingTransaction`.



- Ledger module: types, `createLedgerEntry`, `createLedgerEntryService`.



- `database.ts` mein `withTransaction`: `BEGIN`, `COMMIT`, error pe `ROLLBACK`, phir `client.release()`.



Abhi repository `const db = client ?? pool` likhti hai, lekin query abhi bhi `pool.query` pe hai. `withTransaction` kahin call nahi ho rahi.