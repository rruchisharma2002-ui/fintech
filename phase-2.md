# Phase 2 — Account

Phase 1 mein user banta hai aur login karta hai. Paisa rakhne ki jagah abhi nahi thi.

User ko paise rakhne hain, isliye **account** chahiye. Account us user ki ek jeb hai: kis type ki hai, kis currency mein hai, aur uska number kya hai.

Shuru mein account **khali jeb** thi: sirf jeb banana aur dekhna. Balance, **deposit**, **withdrawal**, aur **transfer** isi phase mein jud gaye. Deposit aur withdrawal ka short compare section 9 mein hai. Deposit ka detail section 10, withdrawal ka detail section 12, transfer ka detail section 13.

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
 `GET /api/v1/accounts/:accountId` 
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

## 4. Chheh API

Chhehon pe `authenticate` lagti hai. Bina `Authorization: Bearer <accessToken>` ke **401**.

| # | Method | Path | Kaam |
|---|---|---|---|
| 1 | POST | `/api/v1/accounts` | is user ka naya account. userId token se |
| 2 | GET | `/api/v1/accounts` | is user ke saare account. userId token se |
| 3 | GET | `/api/v1/accounts/:accountId` | is user ka **ek** account. `accountId` = UUID `id` |
| 4 | POST | `/api/v1/accounts/:accountId/deposit` | is account mein paisa jodo. Main section 9 |
| 5 | POST | `/api/v1/accounts/:accountId/withdraw` | is account se paisa nikalo. Main section 9 |
| 6 | POST | `/api/v1/accounts/:accountId/transfer` | is account se doosre account mein paisa bhejo. Detail section 13 |

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
| `account.routes.ts` | chheh routes: create, list, get, deposit, withdraw, transfer |
| `account.validation.ts` | create, deposit, withdraw, aur transfer ki Zod schema |
| `account.controller.ts` | status + JSON. DB nahi |
| `account.service.ts` | deposit, withdraw, aur transfer: lock, check, transaction, balance, ledger |
| `account.repository.ts` | `INSERT`, `SELECT`, balance `+` / `−`, `FOR UPDATE` |
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

**2. Function expression** — function ek variable mein with function keyword

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
| 201 | account ban gaya, deposit successful, withdrawal successful, ya transfer successful |
| 400 | body galat, account `ACTIVE` nahi, same account pe transfer, ya balance kam (`"Insufficient balance"`) |
| 401 | token nahi, token galat, ya `req.user` nahi |
| 403 | transfer pe source account is user ka nahi |
| 404 | UUID to hai, par account nahi. Transfer pe sender ya receiver mein se koi bhi na mile |
| 500 | DB error. UUID ki jagah account number bhejna abhi yahin aata hai |

---

## Is phase mein nahi hai


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
Deposit isi `withTransaction` ko call karti hai. Transaction aur ledger repository `const db = client ?? pool` use karti hain, phir `db.query`. Account ki balance query seedha `client.query` pe hai, kyunki lock aur update transaction ke andar hone chahiye.

---

## 7. `DB_PORT` string hai, Pool number maangta hai

Environment variable hamesha **string** hoti hai.

```ts
process.env.DB_PORT
```

`.env` mein `DB_PORT=5432` likha ho tab bhi JavaScript ko yeh milta hai:

```text
"5432"
```

Number nahi. Quotes wali text.

PostgreSQL ka `Pool` port ke liye **number** maangta hai. String de doge to type match nahi karta.

Is project mein `src/config/env.ts` convert karti hai:

```ts
port: Number(getEnv("DB_PORT"))
```

`getEnv` string return karti hai. `Number(...)` usko number bana deta hai:

```text
"5432"  →  5432
```

`database.ts` wahi number Pool ko deta hai: `port: env.db.port`.

`Number` tabhi theek hai jab string sach mein number ho. `"5432"` se `5432` banta hai. Khali ya galat value pe `NaN` ban sakta hai. `getEnv` pehle check karti hai ki value hai. Port ki extra range check abhi nahi hai.

---

## 8. Paisa ka rishta — user se balance tak

Account khali jeb nahi rahi. Paisa is chain se chalta hai:

```text
USER
 │
 │ owns
 ▼
ACCOUNT
 │
 │ participates in
 ▼
TRANSACTION
 │
 │ produces
 ▼
LEDGER ENTRIES
 │
 ├── DEBIT
 └── CREDIT
 │
 ▼
LEDGER
 │
 ▼
Account's financial position
 │
 ▼
BALANCE
```

**
# Idempotency
Financial APIs cannot blindly execute the same request twice.

Imagine:

Client

  ↓

Transfer ₹1,000

  ↓

Server processes it

  ↓

Network timeout

The client doesn't know whether it succeeded.

It retries:
Transfer ₹1,000
Without protection:
₹1,000 transferred+1,000 transferred again
❌ Very bad.
So we'll learn:Idempotency-Key and build idempotent financial operations.

**
| Cheez | Kya record karti hai | Example |
|---|---|---|
| Transaction | business event kya hua | Ruchi ne ₹1 bheja |
| Ledger entry | us event ka financial effect | Ruchi **DEBIT** ₹1, doosra account **CREDIT** ₹1 |
| Balance | account ki position, ledger ke baad | account pe kitna paisa hai |

Deposit mein doosra account nahi hota. Paisa bahar se is account mein aata hai, isliye ledger pe sirf **CREDIT** lagta hai. Balance `balance + amount` se badhta hai.

Withdrawal bhi ek hi account hai. Paisa account se bahar jaata hai, isliye ledger pe sirf **DEBIT** lagta hai. Balance `balance - amount` se ghatta hai. Doosra account nahi, isliye doosri ledger entry nahi.

Transfer mein do account hain, transaction ek. Sender pe **DEBIT** aur `balance - amount`. Receiver pe **CREDIT** aur `balance + amount`. Dono ledger entries usi ek `TRANSFER` transaction se judi hoti hain.

---

## 9. Main — deposit aur withdrawal

Dono complete hain. Route, Zod, controller, service, repository. Transfer bhi complete hai, detail section 13. Idempotency teeno pe nahi: same POST do baar bhejoge to paisa do baar judega, katega, ya transfer hoga.

Dono ka shape ek jaisa hai. Farq sirf direction aur balance check ka hai.

| | Deposit | Withdrawal |
|---|---|---|
| Method | POST | POST |
| Path | `/api/v1/accounts/:accountId/deposit` | `/api/v1/accounts/:accountId/withdraw` |
| `accountId` | UUID `id`. Account number nahi | wahi |
| Auth | `authenticate`. Token se `userId` | wahi |
| Body | `{ "amount": "1000.00" }` | wahi |
| Zod | `depositSchema` | `withdrawSchema`. Rule same |
| Service | `depositMoney` | `withdrawMoney` |
| Paisa | andar. `balance + amount` | bahar. `balance - amount` |
| Transaction type | `DEPOSIT` | `WITHDRAWAL` |
| Ledger | **CREDIT** | **DEBIT** |
| Extra check | nahi | `balance >= amount` |
| Kam balance | — | **400** `"Insufficient balance"`. Paisa nahi katta |
| Account nahi | **404** `"Account not found"` | wahi |
| `ACTIVE` nahi | **400** `"Account is not active"` | wahi |
| Success | **201** `"Deposit successful"` | **201** `"Withdrawal successful"` |

`amount` string hai, number nahi. Paisa decimal text ki tarah rehta hai, float rounding se bache. Zod: pattern `^\d+(\.\d{1,2})?$`, aur `Number(value) > 0`. `1000`, `1000.5`, `1000.50` chalega. `0`, `-10`, `10.555`, `"abc"` → **400**. DB tak nahi jaata.

Dono `withTransaction` ke andar hain. Ek client, ek PostgreSQL transaction. `BEGIN`, ant mein `COMMIT`. Beech mein throw → `ROLLBACK`. Transaction row, balance, aur ledger entry teeno wapas. Ya to pura kaam, ya kuch bhi nahi.

Order, dono mein:

1. `findAccountByIdForUpdate` — `id` **aur** `user_id`, `FOR UPDATE`. Row lock. Do request ek saath same balance na badal dein.
2. Account is user ka nahi → `AppError` **404**.
3. `status !== "ACTIVE"` → `AppError` **400**.
4. Withdrawal pe extra: `Number(account.balance) < Number(amount)` → `AppError` **400** `"Insufficient balance"`. Deposit pe yeh check nahi. Paisa bahar se aata hai.
5. `createTransaction` — row `PENDING`. Currency account ki hai, client nahi bhejta. `reference` null.
6. Balance update. Deposit `increaseAccountBalance`. Withdrawal `decreaseAccountBalance`.
7. `createLedgerEntry` — deposit **CREDIT**, withdrawal **DEBIT**. Same amount, same account.
8. `completeTransaction` — DB status `COMPLETED`.
9. `COMMIT`. Lock chhoot-ta hai.

Success body:

```json
{ "message": "Deposit successful", "transaction": { } }
```

Withdrawal ka message `"Withdrawal successful"` hai. Deposit response mein `transaction.status` code `"COMPLETED"` set karke bhejta hai. Withdrawal woh spread nahi karti: DB pe status `COMPLETED` ho chuka hota hai, response `createTransaction` wala object hai.

Postman: balance `0.00` pe `POST .../withdraw` aur `{ "amount": "40.00" }` → **400** `"Insufficient balance"`. Request ka naam deposit ho, URL `/withdraw` ho to yeh withdraw hi hai. Paisa jodna ho to path `/deposit` hona chahiye. Pehle deposit, phir utna ya kam withdraw.

UUID ki jagah account number → Postgres error → **500**. Yeh `AppError` nahi hai.

---

## 10. Deposit API — account mein paisa jodna

Deposit API ka kaam hai **user ke account mein paisa add karna**.

Chauthi API hai. Pehli teen account banati ya dikhati hain. Yeh paise badalti hai.

| | |
|---|---|
| Method | POST |
| Path | `/api/v1/accounts/:accountId/deposit` |
| `accountId` | UUID `id`. Account number nahi |
| Auth | `authenticate`. Token se `userId` |
| Body check | `validateBody(depositSchema)` |

Body sirf amount. String hai, number nahi, kyunki paisa decimal text ki tarah rakhte hain (`"1000.00"`), float rounding se bache.

```json
{ "amount": "1000.00" }
```

Zod rule:

- pattern `^\d+(\.\d{1,2})?$` — poora number, ya point ke baad 1 ya 2 digit
- `Number(value) > 0` — zero ya minus nahi

`1000` chalega. `1000.5` chalega. `1000.50` chalega. `0`, `-10`, `10.555`, `"abc"` → **400**. DB tak nahi jaata.

### Andar kya hota hai

`depositController` → `depositMoney(accountId, userId, amount)`.

Sab `withTransaction` ke andar hai. Ek client, ek PostgreSQL transaction. Beech mein fail hua to `ROLLBACK`: transaction row, balance, aur ledger entry teeno wapas. Ya to pura deposit, ya kuch bhi nahi.

1. `findAccountByIdForUpdate` — `id` **aur** `user_id` match, `FOR UPDATE`. Row lock. Do request ek saath same account ka balance na badal dein.
2. Account is user ka nahi → `AppError` **404** `"Account not found"`.
3. `status !== "ACTIVE"` → `AppError` **400** `"Account is not active"`.
4. `createTransaction("DEPOSIT", amount, account.currency, undefined, client)`. Row `PENDING` banti hai. Currency account ki hai, client nahi bhejta. `reference` null.
5. `increaseAccountBalance` — `balance = balance + amount`, `updated_at = NOW()`.
6. `createLedgerEntry` — isi transaction aur account pe **CREDIT**, same amount.
7. `completeTransaction` — status `COMPLETED`.
8. **201** `{ message: "Deposit successful", transaction }`. Response wale object ka `status` `"COMPLETED"` set karke bheja jata hai.

Client wahi `client` repository tak jaata hai. `const db = client ?? pool` ka matlab: client diya hai to transaction wali query, nahi to alag `pool.query`. Deposit wali calls client deti hain, isliye woh `BEGIN` / `COMMIT` ke andar rehti hain.

Account na mile to **404**. Active na ho to **400**. Dono `AppError` hain, isliye error middleware wahi message aur status bhejti hai, **500** nahi. UUID ki jagah account number bhejne pe pehle jaisa Postgres error, phir **500**.

---

## 11. Idempotency — same request do baar paisa do baar nahi

Financial API same request ko andhe ban kar do baar nahi chala sakti.

```text
Client
  ↓
Transfer ₹1,000
  ↓
Server process kar chuka
  ↓
Network timeout
```

Client ko pata nahi chala success hua ya nahi. Woh retry karta hai:

```text
Transfer ₹1,000
```

Bina protection:

```text
₹1,000 transfer ho gaya
+
₹1,000 phir se transfer ho gaya
```

Deposit aur withdrawal pe wahi nuksan: timeout ke baad retry, balance do baar badh jaana ya do baar kat jaana.

**Idempotency** ka matlab: wahi request dubara aaye to effect ek baar ho. Doosri call naya paisa na jode. Pehli wali result wapas de, ya bata de ki yeh request pehle ho chuki hai.

Abhi deposit, withdrawal, aur transfer pe yeh protection **nahi** hai. Har POST naya transaction, naya ledger entry, aur balance phir se badal deti hai. Same body do baar bhejogi to paisa do baar judega, katega, ya transfer hoga. Idempotency key (client ki ek unique id jo server pehli call yaad rakhe) baad ka kaam hai.

---

## 12. Withdrawal API — account se paisa nikalna

Withdrawal complete hai. `POST /api/v1/accounts/:accountId/withdraw` wired hai: `authenticate`, `validateBody(withdrawSchema)`, `withdrawController`, `withdrawMoney`.

Deposit ka ulta hai. Paisa account mein nahi aata, account se **bahar** jaata hai.

`withdrawMoney` pehle se bane functions ko **order** mein call karti hai. Naya SQL nahi. Koi step beech mein toot gaya to uske baad wala chalta hi nahi, aur `ROLLBACK` ho jaata hai.

### Pehle lock — beech mein koi aur query na aaye

Sab `withTransaction` ke andar hai. Wahi ek client, wahi PostgreSQL transaction.

`withTransaction` shuru mein `BEGIN` karti hai. `withdrawMoney` ke andar jitni queries hain, sab isi client pe chalti hain. Ant mein, agar koi throw nahi hua, `COMMIT`. Koi bhi step pe `throw` hua — account nahi mila, active nahi, balance kam, ya network / DB error — to `ROLLBACK`. Jo rows is call ne likhi thin, woh commit nahi hoti.

Lock pehla kaam hai, balance check se bhi pehle:

`findAccountByIdForUpdate` — `id` **aur** `user_id` match, `FOR UPDATE`.

`FOR UPDATE` is row ko pakad leta hai jab tak yeh transaction `COMMIT` ya `ROLLBACK` na ho. Doosri request isi account ka balance padhe ya badle, woh is lock ke peeche wait karti hai. Isliye beech mein koi aur withdrawal, deposit, ya balance query is row ko badal nahi sakti. Do request ek saath same paise nahi kaat sakte.

Lock aur `BEGIN` / `COMMIT` mil kar atomicity dete hain. Network beech mein gir jaye to aadha withdrawal nahi bachta: transaction row, balance, aur ledger entry teeno wapas. Ya to pura withdrawal, ya kuch bhi nahi.

### Condition — paisa hai ya nahi

Lock ke baad teen check. Koi bhi fail ho to throw, aur `withTransaction` rollback kar deti hai. Decrease, ledger, complete — teeno skip.

1. Account is user ka nahi → `AppError` **404** `"Account not found"`.
2. `status !== "ACTIVE"` → `AppError` **400** `"Account is not active"`.
3. `Number(account.balance) < Number(amount)` → `AppError` **400** `"Insufficient balance"`.

Teesra check deposit mein nahi hai. Deposit mein paisa bahar se aata hai, balance kam hone ka sawal nahi. Withdrawal mein user ne jitna maanga, utna account pe hona chahiye. Kam hai to balance **chhuta hi nahi**.

`Number(...)` isliye: balance aur amount dono string hain (`"1000.00"`). Compare karne ke liye number banate hain. SQL mein cut `balance - $1` se hota hai, string amount ke saath, taaki paisa Postgres ke numeric pe rahe.

### Paisa hai to yeh order, ek ke baad ek

Balance kaafi hai tab hi aage. Har call pehle se bani function hai. `withdrawMoney` naya SQL nahi likhti.

1. `createTransaction("WITHDRAWAL", amount, account.currency, undefined, client)`. Row `PENDING` banti hai. Currency account ki hai. `reference` null. Type `WITHDRAWAL` hai, `DEPOSIT` nahi.
2. `decreaseAccountBalance` — `balance = balance - amount`, `updated_at = NOW()`. Ek `UPDATE`. Rupee ek-ek karke nahi kat-te. Amount ek baar minus hoti hai.
3. `createLedgerEntry` — isi transaction aur account pe **DEBIT**, same amount. Deposit pe **CREDIT** tha, kyunki paisa andar aaya tha. Yahan paisa bahar gaya, isliye ledger pe sirf **DEBIT**. Doosra account nahi, isliye doosri entry nahi.
4. `completeTransaction` — `transactions.status` `COMPLETED`.
5. `withTransaction` `COMMIT` karti hai. Tab ja kar lock chhoot-ta hai aur doosri query is row ko dekh sakti hai.

Beech mein step 2, 3, ya 4 fail ho to step 5 commit nahi hota. `ROLLBACK`: `WITHDRAWAL` row bhi nahi rehti, balance purana rehta hai, DEBIT entry bhi nahi rehti.

`withdrawController` **201** bhejti hai: `{ message: "Withdrawal successful", transaction }`.

`withdrawMoney` return wohi transaction object karti hai jo `createTransaction` ne diya tha. DB pe status `COMPLETED` ho chuka hota hai. Deposit response mein object ka `status` code se `"COMPLETED"` set karke bhejti hai. Withdrawal woh spread nahi karti.

Account na mile → **404**. Active na ho, ya balance kam ho → **400**. Teeno `AppError` hain. Plain `Error` hota to error middleware **500** `"Internal server error"` bhejti. UUID ki jagah account number abhi bhi **500** hai.

---

## 13. Transfer API — ek account se doosre account mein paisa

Transfer complete hai. `POST /api/v1/accounts/:accountId/transfer` wired hai: `authenticate`, `validateBody(transferSchema)`, `transferController`, `transferMoney`.

Deposit aur withdrawal ek account hain. Transfer **do** account hain, transaction **ek**.

| | |
|---|---|
| Method | POST |
| Path | `/api/v1/accounts/:accountId/transfer` |
| `accountId` | sender ka UUID `id`. Account number nahi. Token wale user ka hona chahiye |
| Auth | `authenticate`. Token se `userId` |
| Body check | `validateBody(transferSchema)` |

Body mein receiver aur amount. Dono string.

```json
{ "toAccountId": "<receiver-uuid>", "amount": "1000.00" }
```

`toAccountId` Zod pe UUID hona chahiye. Amount ka rule deposit jaisa: pattern `^\d+(\.\d{1,2})?$`, aur `Number(value) > 0`. `0`, `-10`, `10.555`, `"abc"`, ya UUID na ho → **400**. DB tak nahi jaata.

`userId` body mein nahi. Sender path ka `accountId` hai. Receiver body ka `toAccountId` hai. Receiver doosre user ka ho sakta hai. Isliye lock wali query `user_id` se filter nahi karti.

### Pehle same account — lock se pehle

`fromAccountId === toAccountId` → `AppError` **400** `"Cannot transfer to the same account"`. DB call nahi. Apne account se apne account mein paisa nahi jaata.

### Do row, ek order — deadlock na ho

Sab `withTransaction` ke andar hai. `BEGIN`, ant mein `COMMIT`. Koi `throw` → `ROLLBACK`. Transaction row, dono balance, aur dono ledger entries wapas. Ya to pura transfer, ya kuch bhi nahi.

Deposit aur withdrawal ek row `FOR UPDATE` karte hain, aur SQL mein `user_id` bhi match karte hain. Transfer do row lock karta hai, bina user filter ke:

```sql
WHERE id = $1
  AND ($2::uuid IS NULL OR user_id = $2)
FOR UPDATE
```

`userId` `undefined` jaata hai, isliye `$2` null hai aur sirf `id` se row milti hai. Receiver doosre user ka ho, tab bhi lock lag sake.

Do request ek saath ulta transfer karein — A se B, aur B se A — to order alag hone se deadlock ho sakta hai. Pehli request A lock karke B ka wait kare, doosri B lock karke A ka wait kare. Dono ruk jaayein.

Isliye ids pehle sort hoti hain. Chhota UUID hamesha pehle lock. Phir code unhe wapas sender aur receiver mein baant-ta hai: `firstAccount.id === fromAccountId` to woh sender, warna receiver. Business ka order lock ke baad aata hai, lock ka order hamesha sorted rehta hai.

Dono mein se koi row na mile → `AppError` **404** `"Account not found"`. Message nahi batata kaunsa missing hai.

### Condition — bhejne wala, status, balance

Lock ke baad teen check. Koi bhi fail ho to aage ka paisa nahi chalta, `ROLLBACK` ho jaata hai.

1. `sender.userId !== userId` → `AppError` **403** `"Unauthorized"`. Path ka account is token ka nahi. Deposit aur withdrawal yahan **404** dete hain, kyunki unki SQL `user_id` se filter karti hai aur row hi nahi milti. Transfer mein row pehle mil chuki hoti hai, isliye alag status.
2. Sender ya receiver `ACTIVE` nahi → `AppError` **400** `"Both accounts must be active"`.
3. `Number(sender.balance) < Number(amount)` → `AppError` **400** `"Insufficient balance"`. Receiver ke balance ki koi limit nahi. Paisa uske account mein judta hai.

Teeno `AppError` hain. Plain `Error` hota to error middleware inhe **500** `"Internal server error"` bana deti, asli message chhupa kar. UUID ki jagah account number abhi bhi Postgres error hai, phir **500**.

Currency transaction pe sender ke account ki lagti hai. Client currency nahi bhejta. Sender aur receiver ki currency same hai ya nahi, yeh check abhi nahi hai.

### Paisa hai to yeh order, ek ke baad ek

1. `createTransaction("TRANSFER", amount, sender.currency, undefined, client)`. Row `PENDING`. `reference` null.
2. `decreaseAccountBalance` — sender pe `balance = balance - amount`.
3. `increaseAccountBalance` — receiver pe `balance = balance + amount`.
4. `createLedgerEntry` — sender pe **DEBIT**, same amount, isi transaction ki id.
5. `createLedgerEntry` — receiver pe **CREDIT**, same amount, usi transaction ki id. Do entries, ek event.
6. `completeTransaction` — `transactions.status` `COMPLETED`.
7. `COMMIT`. Dono locks chhoot-te hain.

Beech mein koi step fail ho to commit nahi hota. Sender ka paisa kata aur receiver ko na mila, yeh nahi bachta.

`transferController` **201** bhejti hai: `{ message: "Transfer successful", transaction }`.

Return wohi object hai jo `createTransaction` ne diya tha. DB pe status `COMPLETED` ho chuka hota hai. Response ke object mein `status` abhi bhi `"PENDING"` dikhta hai. Withdrawal bhi yahi karti hai. Deposit response mein code `status` ko `"COMPLETED"` set karke bhejti hai.

Idempotency abhi nahi. Same body do baar → do `TRANSFER` rows, paisa do baar.