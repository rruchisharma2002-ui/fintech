# Audit Log — poora explanation

Is file mein audit log ka saara kaam hai: kya hai, kyun chahiye, table kaise bani, har file ka code line-by-line, aur yeh kahan-kahan lagta hai.

Commits:

| Commit | Kya hua |
|---|---|
| `1a4eb81 auditlog` | table, types, repository bane. Account create, withdrawal, transfer pe log laga |
| `d684987 postman testing` | deposit pe bhi log laga, transfer ka duplicate log hataya, aur **fail hua transfer** (doosre ka account) bhi log hone laga |

---

## 1. Audit log kya hota hai

**Audit** = jaanch. Jaise CA company ke hisaab ki jaanch karta hai.
**Log** = diary. Ek ke baad ek likhi hui entries.

**Audit log** = ek diary jisme likha jaata hai: **kisne**, **kab**, **kya** kiya, aur **kis cheez** pe kiya.

Example — ek row ka matlab:

> Ruchika (`user_id`) ne 15 Oct raat 12:30 baje (`created_at`) ek transfer pura kiya (`action = TRANSFER_COMPLETED`). Woh transfer ek transaction tha (`resource_type = TRANSACTION`) jiski id `9f3a...` hai (`resource_id`). Usme ₹500 INR, account A se B gaye (`details`).

### Kyun chahiye — ledger already hai na?

Ledger aur audit log alag kaam karte hain:

| | Ledger (`ledger_entries`) | Audit log (`audit_logs`) |
|---|---|---|
| Kya rakhta hai | **paisa** — kis account pe kitna DEBIT/CREDIT | **action** — kisne kya kiya |
| Account banaya — likha jaata hai? | nahi, paisa nahi hila | haan, `ACCOUNT_CREATED` |
| Koi doosre ka account se transfer try kare | nahi, paisa hila hi nahi | haan, `TRANSFER_AUTHORIZATION_FAILED` |
| Kaun dekhta hai | balance calculation, accounting | support team, security team, regulator (RBI jaise) |

Fintech mein real duniya ke sawal aate hain:

- "Mera account kab bana?" → audit log
- "Kal raat kisi ne mere account se transfer try kiya?" → audit log
- "Is user ne pichle 30 din mein kya-kya kiya?" → audit log

Ledger sirf paisa jaanta hai. Insaan ne kya **kiya**, woh audit log jaanta hai.

### Ek important rule — audit log kabhi edit ya delete nahi hota

Diary mein likha hua mitaya nahi jaata. Audit log mein sirf `INSERT` hota hai. Na `UPDATE`, na `DELETE`. Isliye hamare repository mein sirf ek hi function hai: `createAuditLog`. Update ya delete ka function hai hi nahi — jaan-boojh kar.

---

## 2. Files — kya bana, kya badla

| File | Naya / badla | Kaam |
|---|---|---|
| `migrations/010_create_audit_logs.sql` | naya | database mein `audit_logs` table banata hai |
| `src/modules/audit/audit.types.ts` | naya | TypeScript ko batata hai ki ek audit row kaisi dikhti hai |
| `src/modules/audit/audit.repository.ts` | naya | `createAuditLog` — SQL `INSERT` |
| `src/modules/account/account.service.ts` | badla | 5 jagah `createAuditLog` call hota hai |
| `src/shared/errors/app.error.ts` | badla | `AppError` mein naya `code` field, taaki pata chale kaunsi galti hui |

Flow:

```
account.service.ts
   → createAuditLog(...)        audit.repository.ts
      → INSERT INTO audit_logs   Postgres
```

Audit ka koi route ya controller nahi hai. Client seedha audit log nahi banata. **Server khud** banata hai jab koi kaam hota hai. Isliye client jhootha log nahi bhej sakta.

---

## 3. Migration — `010_create_audit_logs.sql`

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE RESTRICT,

    action VARCHAR(100) NOT NULL,

    resource_type VARCHAR(50) NOT NULL,

    resource_id UUID,

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Har word ka matlab

| Word | Matlab |
|---|---|
| `CREATE TABLE audit_logs` | `audit_logs` naam ki nayi table banao |
| `UUID` | 36 characters ki unique id, jaise `550e8400-e29b-41d4-a716-446655440000`. Duniya mein do same nahi bante |
| `PRIMARY KEY` | yeh column har row ki pehchaan hai. Do rows ki same `id` nahi ho sakti, aur khaali bhi nahi ho sakti |
| `DEFAULT gen_random_uuid()` | insert karte waqt `id` nahi diya to Postgres khud random UUID bana dega |
| `REFERENCES users(id)` | **foreign key**. `user_id` mein wahi value aa sakti hai jo `users` table ki `id` mein hai. Koi nakli user id nahi daal sakta |
| `ON DELETE RESTRICT` | jis user ke audit log hain, us user ko `users` table se delete **nahi** kar sakte. Postgres error dega |
| `VARCHAR(100)` | text, maximum 100 characters |
| `NOT NULL` | yeh column khaali (`NULL`) nahi ho sakta. Value deni hi padegi |
| `JSONB` | JSON data, binary form mein store hota hai. Andar search bhi kar sakte ho |
| `'{}'::jsonb` | `'{}'` text hai, `::jsonb` usko JSONB type mein badalta hai. Matlab: khaali object `{}` |
| `TIMESTAMPTZ` | date + time + **timezone**. India ka 12:30 aur London ka 7:00 same pal hai — Postgres sahi samjhega |
| `DEFAULT NOW()` | time nahi diya to abhi ka time daal do |

### Har column — kya hai aur kyun

| Column | Example value | Kyun chahiye |
|---|---|---|
| `id` | `a1b2...` | har log row ki apni pehchaan |
| `user_id` | Ruchika ki user id | **kisne** kiya |
| `action` | `TRANSFER_COMPLETED` | **kya** kiya |
| `resource_type` | `TRANSACTION` | **kis type ki cheez** pe kiya |
| `resource_id` | transaction ki id | **kaunsi** cheez pe kiya |
| `details` | `{"amount": "500.00", "currency": "INR"}` | extra jaankari. Har action ki alag hoti hai, isliye JSON |
| `created_at` | `2026-10-15 00:30:00+05:30` | **kab** kiya |

### Kuch sawal jo dimaag mein aayenge

**`user_id` pe `NOT NULL` kyun nahi?**
Kabhi-kabhi kaam kisi user ne nahi, **system** ne kiya hota hai. Jaise raat ko cron job ne interest joda. Ya login fail hua aur user pata hi nahi. Tab `user_id` `NULL` hoga.

**`resource_id` pe `NOT NULL` kyun nahi?**
Har action kisi ek cheez pe nahi hota. Jaise "user ne logout kiya" — iska koi resource nahi.

**`ON DELETE RESTRICT` kyun, `CASCADE` kyun nahi?**
`CASCADE` ka matlab hota: user delete → uske saare audit log bhi delete. Matlab saboot gayab. Fintech mein yeh allowed nahi. `RESTRICT` bolta hai: pehle soch lo, user ko delete nahi kar sakte jab tak uska record hai.

**`details` alag-alag columns kyun nahi, JSON kyun?**
Transfer ke details: `fromAccountId`, `toAccountId`, `amount`, `currency`.
Account create ke details: `type`, `currency`.
Har action ke details alag hain. Har ek ka column banaoge to table mein 50 columns honge, zyada tar khaali. JSON mein jo chahiye woh daal do.

**`action` aur `resource_type` VARCHAR kyun, `CHECK` kyun nahi (jaise accounts ke `type` pe tha)?**
Actions badhte rahenge: `LOGIN`, `PASSWORD_CHANGED`, `ACCOUNT_CLOSED`... Har naye action pe migration likhna padta. Isliye DB mein free text rakha, aur galti se bachne ke liye TypeScript mein type lagaya (section 4).

### Indexes

```sql
CREATE INDEX idx_audit_logs_user_id
ON audit_logs(user_id);

CREATE INDEX idx_audit_logs_resource
ON audit_logs(resource_type, resource_id);

CREATE INDEX idx_audit_logs_created_at
ON audit_logs(created_at DESC);
```

**Index** = kitaab ke peeche wala index. "Transfer" kis page pe hai, seedha wahan jao, poori kitaab mat padho. Bina index ke Postgres har row padhega (isko **full table scan** kehte hain). Audit log mein lakhon rows hoti hain, isliye index zaroori hai.

| Index | Kis sawal ko fast karta hai |
|---|---|
| `idx_audit_logs_user_id` | "is user ne kya-kya kiya?" → `WHERE user_id = ...` |
| `idx_audit_logs_resource` | "is transaction / account ke saath kya-kya hua?" → `WHERE resource_type = 'TRANSACTION' AND resource_id = ...` |
| `idx_audit_logs_created_at` | "latest 50 logs dikhao" → `ORDER BY created_at DESC` |

`DESC` = descending, bade se chhota. Yahan naya time pehle, purana baad mein.

`idx_audit_logs_resource` mein do columns ek saath hain. Isko **composite index** kehte hain. Order matter karta hai: pehle `resource_type`, phir `resource_id`. Jaise phone book: pehle surname, phir naam.

---

## 4. Types — `audit.types.ts`

```ts
export type AuditResourceType =
    | "USER"
    | "ACCOUNT"
    | "TRANSACTION";
```

| Code | Matlab |
|---|---|
| `export` | yeh type doosri files `import` kar sakti hain |
| `type AuditResourceType =` | naya type bana rahe hain, naam `AuditResourceType` |
| `"USER" \| "ACCOUNT" \| "TRANSACTION"` | **union type**. `\|` ka matlab "ya". Value in teen mein se koi ek hi ho sakti hai |

Agar galti se `createAuditLog(..., "ACOUNT", ...)` likho (spelling galat), TypeScript code chalne se **pehle** hi laal line dikha dega. Database mein `CHECK` nahi hai, isliye yeh bachav TypeScript karta hai.

```ts
export type AuditEvent = {
    id: string;
    userId: string | null;
    action: string;
    resourceType: AuditResourceType;
    resourceId: string | null;
    details: Record<string, unknown>;
    createdAt: Date;
};
```

Yeh ek audit row ka shape hai, jaisa database se wapas aata hai.

| Field | Type | Matlab |
|---|---|---|
| `id` | `string` | UUID JavaScript mein string hi hota hai |
| `userId` | `string \| null` | string ya null. DB mein `user_id` NULL ho sakta hai, isliye |
| `action` | `string` | koi bhi text |
| `resourceType` | `AuditResourceType` | upar wale teen mein se ek |
| `resourceId` | `string \| null` | DB mein NULL ho sakta hai, isliye |
| `details` | `Record<string, unknown>` | ek object jiski **keys string** hain aur **values kuch bhi** ho sakti hain. `{ amount: "500", currency: "INR" }` bhi chalega, `{ type: "SAVINGS" }` bhi |
| `createdAt` | `Date` | `pg` library `TIMESTAMPTZ` ko JavaScript `Date` bana deti hai |

**`unknown` kyun, `any` kyun nahi?**
Dono "kuch bhi" maante hain. Lekin `any` ke saath TypeScript checking band kar deta hai. `unknown` ke saath, use karne se pehle check karna padta hai. `unknown` safe hai.

**Database mein `user_id`, yahan `userId` kyun?**
SQL mein naam `snake_case` mein likhte hain (`user_id`). JavaScript mein `camelCase` (`userId`). Repository mein `AS "userId"` se naam badalte hain (section 5).

---

## 5. Repository — `audit.repository.ts`

Poora code:

```ts
import { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import { AuditEvent, AuditResourceType } from "./audit.types.js";

export async function createAuditLog(
    userId: string | null,
    action: string,
    resourceType: AuditResourceType,
    resourceId: string | null,
    details: Record<string, unknown> = {},
    client?: PoolClient,
): Promise<AuditEvent> {
    const db = client ?? pool;
    const result = await db.query<AuditEvent>(
        `
        INSERT INTO audit_logs (
            user_id,
            action,
            resource_type,
            resource_id,
            details
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            user_id AS "userId",
            action,
            resource_type AS "resourceType",
            resource_id AS "resourceId",
            details,
            created_at AS "createdAt"
        `,
        [
            userId,
            action,
            resourceType,
            resourceId,
            JSON.stringify(details)
        ]
    );

    return result.rows[0];
}
```

### Imports

| Line | Matlab |
|---|---|
| `import { PoolClient } from "pg"` | `PoolClient` = database ka **ek** connection. Transaction ke andar yahi use hota hai |
| `import { pool } from "../../config/database.js"` | `pool` = connections ka group. Jab transaction nahi chahiye, pool se koi bhi khaali connection le lo |
| `import { AuditEvent, AuditResourceType } ...` | upar wale types |

`.js` kyun, file to `.ts` hai? Project ESM mode mein hai. TypeScript compile hoke `.js` banti hai, aur import us `.js` file ka path maangta hai. Baaki project mein bhi yahi pattern hai.

### Function ka signature

```ts
export async function createAuditLog(
```

| Word | Matlab |
|---|---|
| `export` | doosri file (`account.service.ts`) ise use kar sake |
| `async` | function database ka wait karega, isliye `await` use kar sakte hain. Ek `Promise` return karta hai |
| `function createAuditLog` | function ka naam |

Parameters — order yaad rakhna, call karte waqt isi order mein dene hote hain:

| # | Parameter | Type | Matlab |
|---|---|---|---|
| 1 | `userId` | `string \| null` | kisne kiya |
| 2 | `action` | `string` | kya kiya, jaise `"DEPOSIT_COMPLETED"` |
| 3 | `resourceType` | `AuditResourceType` | `"USER"`, `"ACCOUNT"` ya `"TRANSACTION"` |
| 4 | `resourceId` | `string \| null` | kis cheez ki id |
| 5 | `details` | `Record<string, unknown> = {}` | extra info. `= {}` matlab **default value**: nahi diya to khaali object |
| 6 | `client?` | `PoolClient` | `?` matlab **optional**. Do to transaction ke andar likhega, mat do to pool se |

```ts
): Promise<AuditEvent> {
```

Function wapas deta hai `Promise<AuditEvent>`. Matlab: abhi nahi, thodi der baad (DB jawab de tab) ek `AuditEvent` milega. `await` lagake us value ko le sakte ho.

### `client ?? pool`

```ts
const db = client ?? pool;
```

`??` = **nullish coalescing**. Matlab: left wali value `null` ya `undefined` hai to right wali lo.

- `client` diya → `db = client` → query **transaction ke andar** chalegi
- `client` nahi diya → `db = pool` → query **alag**, apne aap commit ho jaayegi

Yeh kyun zaroori hai, section 6 mein samjhaaya hai. Yahi pattern `createAccount`, `createIdempotencyKey` mein bhi hai.

### Query

```ts
const result = await db.query<AuditEvent>(`...SQL...`, [ ...values... ]);
```

| Hissa | Matlab |
|---|---|
| `await` | DB ka jawab aane tak ruko |
| `db.query` | SQL chalao |
| `<AuditEvent>` | TypeScript ko batao ki wapas aane wali rows `AuditEvent` jaisi hongi |
| pehla argument | SQL text (backticks `` ` `` mein, taaki kai lines mein likh sakein) |
| doosra argument | array — SQL ke `$1, $2...` ki values |

### SQL — `INSERT`

```sql
INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id, details
)
VALUES ($1, $2, $3, $4, $5)
```

`audit_logs` table mein ek nayi row daalo. In 5 columns mein, in 5 values ke saath.

`id` aur `created_at` nahi diye. Dono ka `DEFAULT` hai, Postgres khud bhar dega.

**`$1, $2...` kya hai?** Placeholder. `$1` = array ka pehla item (`userId`), `$2` = doosra (`action`), aise hi aage.

**Seedha value string mein kyun nahi jodi?** Jaise `` `VALUES ('${userId}', ...)` ``. Kyunki koi `userId` mein `'); DROP TABLE users; --` bhej de to woh SQL ban ke chal jaayega. Isko **SQL injection** kehte hain. `$1` ke saath `pg` library value ko hamesha **data** maanti hai, kabhi SQL code nahi.

### SQL — `RETURNING`

```sql
RETURNING
    id,
    user_id AS "userId",
    action,
    resource_type AS "resourceType",
    resource_id AS "resourceId",
    details,
    created_at AS "createdAt"
```

`RETURNING` = insert hone ke baad, nayi row ke yeh columns wapas bhejo. Isse alag `SELECT` nahi chalana padta. Postgres ne jo `id` aur `created_at` khud banaye, woh bhi mil jaate hain.

`AS "userId"` = wapas aate waqt column ka naam badal do. `user_id` → `userId`. Double quotes `" "` zaroori hain, warna Postgres naam ko small letters mein kar deta (`userid`).

### Values ka array

```ts
[
    userId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(details)
]
```

**`JSON.stringify(details)` kyun?**
`details` ek JavaScript object hai: `{ amount: "500" }`. `JSON.stringify` usko text bana deta hai: `'{"amount":"500"}'`. Postgres ka `JSONB` column yeh text le ke JSON mein store kar leta hai. Idempotency repository mein `response` ke saath bhi yahi kiya tha.

### Return

```ts
return result.rows[0];
```

`result.rows` = jo rows wapas aayi, unka array. Hamne ek hi row insert ki, to `[0]` = pehli (aur akeli) row.

---

## 6. Service mein kahan-kahan laga — `account.service.ts`

5 jagah log banta hai:

| Kab | `action` | `resource_type` | `resource_id` | `details` |
|---|---|---|---|---|
| naya account bana | `ACCOUNT_CREATED` | `ACCOUNT` | account ki id | `type`, `currency` |
| deposit pura hua | `DEPOSIT_COMPLETED` | `TRANSACTION` | transaction ki id | `accountId`, `amount`, `currency` |
| withdrawal pura hua | `WITHDRAWAL_COMPLETED` | `TRANSACTION` | transaction ki id | `accountId`, `amount`, `currency` |
| transfer pura hua | `TRANSFER_COMPLETED` | `TRANSACTION` | transaction ki id | `fromAccountId`, `toAccountId`, `amount`, `currency` |
| doosre ke account se transfer try kiya | `TRANSFER_AUTHORIZATION_FAILED` | `ACCOUNT` | jis account se try kiya | `attemptedAction: "TRANSFER"` |

Naming rule: `CHEEZ_KYA_HUA`, saare capital letters, beech mein underscore. `COMPLETED` = kaam ho gaya. `FAILED` = nahi hua.

Pehle 4 ek tarah kaam karte hain (**andar** transaction ke). Paanchwa alag hai (**bahar** transaction ke). Dono samajhna zaroori hai.

### 6.1 Account create — transaction ke andar

```ts
export async function createUserAccount(userId, type, currency) {
  return await withTransaction(async (client) => {
    const account = await createAccount(userId, type, currency, client);
    await createAuditLog(
      userId,
      "ACCOUNT_CREATED",
      "ACCOUNT",
      account.id,
      {
        type: account.type,
        currency: account.currency,
      },
      client,
    );

    return account;
  });
}
```

**Pehle kya tha:** `createAccount(userId, type, currency)` — sirf ek query, transaction ki zaroorat nahi thi.

**Ab kya hai:** do queries hain (account `INSERT` + audit `INSERT`). Dono ek saath honi chahiye. Isliye `withTransaction` mein lapeta.

`withTransaction` yaad hai? (`src/config/database.ts`)

```
BEGIN
   → callback chalao (andar ki saari queries)
COMMIT     ← sab theek → saari queries pakki
ROLLBACK   ← koi bhi error → saari queries cancel, jaise hui hi nahi
```

**Dono mein `client` dena kyun zaroori hai?**

`BEGIN` ek connection (`client`) pe chala hai. Transaction **sirf usi connection** pe hai. Agar `createAccount` ko `client` nahi diya to woh `pool` se **doosra** connection lega. Woh query transaction ke bahar chalegi aur turant commit ho jaayegi.

Socho:

```
createAccount(... )          ← client nahi diya, pool se chala, commit ho gaya
createAuditLog(..., client)  ← error aaya
ROLLBACK                     ← sirf audit log cancel hua
```

Result: account ban gaya, audit log nahi bana. Record mein chhed. Pehle commit (`1a4eb81`) mein yahi galti thi. Baad mein `client` pass kar diya — ab dono ek saath hote hain ya dono nahi.

Is "dono ya koi nahi" ko **atomicity** kehte hain (ACID ka **A**).

### 6.2 Deposit aur withdrawal — transaction ke andar

Withdrawal ka last hissa (deposit bilkul aisa hi hai, sirf `"DEPOSIT_COMPLETED"`):

```ts
    const completedTransaction = await completeTransaction(
      transaction.id,
      client,
    );

    await createAuditLog(
      userId,
      "WITHDRAWAL_COMPLETED",
      "TRANSACTION",
      completedTransaction.id,
      {
        accountId: account.id,
        amount: completedTransaction.amount,
        currency: completedTransaction.currency,
      },
      client,
    );

    return completedTransaction;
```

**Log `completeTransaction` ke baad kyun?**
Log ka naam `COMPLETED` hai. Pehle likhte aur baad mein kuch fail hota to log jhooth bolta. Baad mein likha to sach hai — waise bhi, fail hota to `ROLLBACK` log ko bhi hata deta.

**`resource_type` `TRANSACTION` kyun, `ACCOUNT` kyun nahi?**
Kaam ek **transaction** hai (paisa hila). Account kaunsa tha, woh `details.accountId` mein hai. Baad mein "is transaction ke saath kya hua" dhoondhna ho to `resource_id = transaction id` se seedha mil jaayega (index bhi hai).

**`amount` `completedTransaction.amount` se kyun, function ke `amount` parameter se kyun nahi?**
Parameter mein jo client ne bheja woh hai, jaise `"500"`. `completedTransaction.amount` mein jo **database mein save hua** woh hai, jaise `"500.00"`. Audit mein wahi likho jo sach mein hua.

**`completeTransaction` ab `RETURNING` deta hai** — idempotency wale commit (`a3b9900`) mein badla tha. Isi wajah se `completedTransaction.id`, `.amount`, `.currency` yahan mil rahe hain.

### 6.3 Transfer pura hua — transaction ke andar

```ts
      // Update idempotency key
      await updateIdempotencyKey(
        idempotency.record.id,
        "COMPLETED",
        completedTransaction,
        client,
      );

      // Create audit log
      await createAuditLog(
        userId,
        "TRANSFER_COMPLETED",
        "TRANSACTION",
        completedTransaction.id,
        {
          fromAccountId: sender.id,
          toAccountId: receiver.id,
          amount: completedTransaction.amount,
          currency: completedTransaction.currency,
        },
        client,
      );

      return completedTransaction;
```

Same idea. Ek baat dhyan dene ki:

**Pehle commit (`1a4eb81`) mein yeh log 2 baar likha tha** — copy-paste se. Har transfer pe 2 rows banti. `d684987` mein ek hata diya. Ab sirf ek hai.

**Retry pe log nahi banta.** Same `Idempotency-Key` dobara aaye to function upar hi `return record.response` kar deta hai. Neeche tak pahunchta hi nahi. Sahi hai — transfer ek hi baar hua, log bhi ek hi baar.

### 6.4 Doosre ke account se transfer — transaction ke **bahar**

Yeh sabse interesting hai.

**Scenario:** Hacker ne login kiya (apne account se). Phir URL mein kisi aur ka `accountId` daal diya:

```
POST /api/v1/accounts/<RUCHIKA_KA_ACCOUNT_ID>/transfer
```

Code ownership check karta hai:

```ts
      // 9. Verify sender ownership
      if (sender.userId !== userId) {
        throw new AppError(
          404,
          "Account not found",
          "TRANSFER_SENDER_OWNERSHIP_MISMATCH",
        );
      }
```

Hacker ko **404 "Account not found"** milta hai. Use pata nahi chalta ki account exist karta hai.

Lekin **humein** pata hona chahiye ki kisi ne try kiya. Yeh security event hai. Isliye log banana hai.

**Problem:** Error `withTransaction` ke andar phenka gaya. Matlab `ROLLBACK` hoga. Andar `createAuditLog(..., client)` likhte to woh bhi rollback ho jaata. Log kabhi save hi nahi hota.

**Solution:** Poore `withTransaction` ko `try/catch` mein lapeto. Error **bahar** pakdo, `ROLLBACK` ke **baad**. Phir log likho — **bina `client` ke**, matlab `pool` se, alag se, apne aap commit:

```ts
export async function transferMoney(...) {
  try {
    return await withTransaction(async (client) => {
      // ... poora transfer ...
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "TRANSFER_SENDER_OWNERSHIP_MISMATCH"
    ) {
      try {
        await createAuditLog(
          userId,
          "TRANSFER_AUTHORIZATION_FAILED",
          "ACCOUNT",
          fromAccountId,
          {
            attemptedAction: "TRANSFER",
          },
        );
      } catch (auditError) {
        console.error(
          "Failed to record authorization audit event:",
          auditError,
        );
      }
    }
    throw error;
  }
}
```

Line by line:

| Code | Matlab |
|---|---|
| `try { return await withTransaction(...) }` | transfer chalao. Sab theek → result return, `catch` chalega hi nahi |
| `catch (error)` | koi bhi error aaya → yahan aao. Is waqt tak `ROLLBACK` ho chuka hai, connection bhi wapas pool mein |
| `error instanceof AppError` | kya yeh hamara banaya hua `AppError` hai? (DB crash jaisa koi aur error bhi ho sakta hai) |
| `error.code === "TRANSFER_SENDER_OWNERSHIP_MISMATCH"` | kya yeh **ownership** wali galti hai? Insufficient balance pe log nahi chahiye, sirf is pe |
| `createAuditLog(...)` — 6th argument nahi | `client` nahi diya → `pool` use hoga → transaction ke bahar → turant save |
| `"ACCOUNT"`, `fromAccountId` | hacker ne kis account ko target kiya. Woh account ki id |
| `userId` | **hacker** ki user id (token se aayi). Ab pata hai kaun tha |
| andar wala `try/catch (auditError)` | agar log likhna fail ho jaaye (DB down) to bhi app crash na ho. Bas console mein likh do |
| `console.error(...)` | server ki terminal mein laal error print karo |
| `throw error` | asli error (404) aage bhejo, taaki client ko 404 mile. Hum sirf log likhne beech mein ruke the, error nigla nahi |

**Andar wala `try/catch` kyun zaroori hai?**
Bina iske: log fail → `auditError` phenka jaata → client ko 404 ki jagah 500 milta, aur asli error kho jaata. Log likhna **side kaam** hai. Side kaam fail ho to main jawab nahi badalna chahiye.

### `AppError` mein `code` kyun joda

```ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

| Code | Matlab |
|---|---|
| `class AppError extends Error` | JavaScript ke `Error` ka apna version |
| `public statusCode: number` | HTTP status, jaise 404. `public` likhne se yeh apne aap `this.statusCode` ban jaata hai |
| `message: string` | client ko dikhne wala text |
| `public code?: string` | **naya**. Optional (`?`). Andar ki pehchaan, client ko nahi jaati |
| `super(message)` | parent `Error` ko message do |
| `this.name = "AppError"` | stack trace mein naam dikhe |

**`message` se check kyun nahi kiya?** `"Account not found"` to 404 wale **aur** jagah bhi aata hai (step 7 — account exist hi nahi karta). Message se pata nahi chalega kaunsa wala hai. `code` unique hai: `TRANSFER_SENDER_OWNERSHIP_MISMATCH` sirf ek jagah phenka jaata hai.

### Andar vs bahar — ek line mein

| | Andar (`client` diya) | Bahar (`client` nahi diya) |
|---|---|---|
| Kab | kaam **pura hua** | kaam **fail hua**, lekin record chahiye |
| Rollback pe | log bhi hat jaata hai ✅ (kaam hua hi nahi, to log bhi nahi) | log bacha rehta hai ✅ (try hua tha, woh sach hai) |
| Examples | `ACCOUNT_CREATED`, `DEPOSIT_COMPLETED`, `WITHDRAWAL_COMPLETED`, `TRANSFER_COMPLETED` | `TRANSFER_AUTHORIZATION_FAILED` |

---

## 7. Kab log **nahi** banta

| Situation | Log? | Kyun |
|---|---|---|
| account list / ek account dekhna (`GET`) | nahi | sirf padhna hai, kuch badla nahi |
| transaction history dekhna | nahi | same |
| insufficient balance | nahi | user ki normal galti, security issue nahi |
| account active nahi, currency alag | nahi | same |
| idempotency retry | nahi | kaam pehli baar mein ho chuka, log bhi |
| Zod validation fail (galat body) | nahi | request service tak pahunchi hi nahi |

---

## 8. Test kaise karein

### Migration chalao

```bash
npm run migrate up
```

### Postman se kaam karo, phir DB mein dekho

```sql
-- latest 10 logs
SELECT action, resource_type, resource_id, details, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;

-- ek user ne kya-kya kiya
SELECT action, details, created_at
FROM audit_logs
WHERE user_id = '<USER_ID>'
ORDER BY created_at DESC;

-- kisi transaction ka log
SELECT *
FROM audit_logs
WHERE resource_type = 'TRANSACTION'
  AND resource_id = '<TRANSACTION_ID>';

-- kisne doosre ke account se transfer try kiya
SELECT user_id, resource_id AS target_account, created_at
FROM audit_logs
WHERE action = 'TRANSFER_AUTHORIZATION_FAILED';
```

### Checklist

| Test | Expected |
|---|---|
| account banao | `ACCOUNT_CREATED` ki **1** row |
| deposit karo | `DEPOSIT_COMPLETED` ki 1 row |
| withdrawal karo | `WITHDRAWAL_COMPLETED` ki 1 row |
| transfer karo | `TRANSFER_COMPLETED` ki **1** row (2 nahi) |
| same `Idempotency-Key` se transfer dobara | **koi naya** row nahi |
| User B ke token se User A ke account se transfer | client ko **404**, DB mein `TRANSFER_AUTHORIZATION_FAILED` ki 1 row, `user_id` = User B |
| balance se zyada withdrawal | **409**, koi log nahi |

---

## 9. Aage kya kar sakte hain (abhi nahi hai)

| Idea | Kyun |
|---|---|
| `action` ka bhi TypeScript union type banao (`"ACCOUNT_CREATED" \| "DEPOSIT_COMPLETED" \| ...`) | abhi `string` hai, `"DEPOSIT_COMPLETD"` (typo) bhi chal jaayega |
| login, logout, password change, refresh token reuse pe log | security ke liye sabse zaroori events yahi hain |
| `ip_address`, `user_agent` columns | kis device / jagah se kiya, woh bhi pata chale |
| admin ke liye `GET /audit-logs` API | abhi sirf SQL se dekh sakte ho |
| DB user ko `audit_logs` pe `UPDATE`/`DELETE` permission hi mat do | code mein function nahi hai, lekin DB level pe bhi rok lagao |
| migration file ke upar `-- Up Migration` likho | baaki saari migration files (`006`–`009`) mein hai, `010` mein nahi. Consistency ke liye |

---

## 10. Yaad rakhne wali baatein (interview ke liye bhi)

1. **Ledger = paisa. Audit log = action.** Dono alag.
2. Audit log **sirf INSERT** hota hai. Kabhi update / delete nahi.
3. Client audit log nahi banata, **server** banata hai.
4. Successful kaam ka log **usi transaction** mein (`client` pass karo) → kaam rollback to log bhi rollback.
5. Failed security event ka log **transaction ke bahar** (`pool`) → rollback ke baad bhi bacha rahe.
6. Log likhna fail ho to main response mat todo (andar wala `try/catch`).
7. `ON DELETE RESTRICT` → saboot delete nahi hone dete.
8. `details` JSONB → har action ke alag details, ek hi column mein.
9. Indexes un sawalon ke liye banao jo sach mein poochhe jaayenge: kis user ne, kis cheez pe, kab.
