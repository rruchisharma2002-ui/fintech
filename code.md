# Request Flow — Client se Server tak

Client request bhejta hai, server response deta hai.

Yeh flow hota hai:

**route → controller → service → repository (agar DB chahiye) → postgres**

Isko loosely **MVC architecture** bhi bolte hain (kuch kuch).

---

## Poora Flow (simple)

```
CLIENT (Postman / frontend)
        ↓  request
     ROUTE          →  API path / endpoint decide
        ↓
   CONTROLLER       →  req aayi, res wapas bhejega
        ↓
    SERVICE         →  kaam karega (input lo, output do)
        ↓
  REPOSITORY        →  DB se baat (agar data chahiye)
        ↓
   POSTGRES         →  asal database
        ↓
response wapas controller ke through client ko
```

**Kaun kisko connect karta hai:**

- **Route** connect karta hai **controller** ko
- **Controller** connect karta hai **service** ko
- **Service** connect karta hai **repository** ko (agar DB chahiye)
- **Repository** connect karta hai **postgres** ko, **pool** se

---

## 1. Route

**Kaam:** woh path banana jahan request aayegi.

Hum route banate hain jahan hamari request aayegi.

Example:

- `POST /api/v1/user/register`
- `POST /api/v1/user/login`

Is route pe request aayi, ab **kaun handle karega req aur res?**

→ **Controller**

Route khud kaam nahi karta.  
Route sirf bolta hai: *is path pe yeh controller function chalao.*

```ts
userRouter.post("/register", register);
userRouter.post("/login", login);
```

---

## 2. Controller  ✅ clear? yessss
{
  Controller HTTP se baat karta hai:

req.body se data nikaalta hai
service ko call karta hai
HTTP status + JSON bhejta hai
Register success → 201 Created.
Login fail → 401 Unauthorized.

Password hash yahan nahi hota. Woh service ka kaam hai.
}

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

Login mein bhi same:

- service se user aaya → `res.json(user)`
- user nahi aaya (`null`) → `401` + `"Invalid email or password"`

---

## 3. Service

Service ka kaam **sirf input leke output dena** hai.

Service **req / res** nahi dekhti.  
Service ko **HTTP se matlab nahi**.

Uske liye:

- input = name, email, password
- output = user, ya null

**Important points:**

- Service **independent** ho sakti hai
- **Kai controllers same service** use kar sakte hain
- Controller ke paas req aati hai, lekin service ke paas **directly req nahi** aati
- Controller req se data nikal ke **plain input** service ko deta hai

```ts
// controller se aaya input, req nahi
registerUser(name, email, password)
loginUser(email, password)
```

Register service kya karti hai:

1. password ko hash karti hai (`bcrypt.hash`)
2. repository ko bolti hai: user bana do
3. user return karti hai

Login service kya karti hai:

1. email se user nikaalo (repository se)
2. user nahi mila → `null`
3. password compare karo
4. match nahi hua → `null`
5. match hua → user return

---

## 4. Repository

Jo kaam **DB se** karwana hai, jaise DB se interaction,  
uska function hum **repository** mein likhenge.

Repository **directly database** se baat karti hai.  
Connection **pool** se bani hoti hai.

Service ko user data chahiye email ke basis pe.  
Toh DB se interact karne ke liye **repository** chahiye.

Repository ke functions:

- `createUser(...)` → DB mein naya user insert
- `findUserByEmail(...)` → email se user dhoondho

**Promise wala point:**

Function ke parameters mein woh data aata hai jo promise se pehle pata hota hai  
(jaise name, email, password).

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

---

## Destructuring (HW)

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

> **HW:** Learn about destructuring

---

## bcrypt.compare — hamesha confusion wali line

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

## Ek request ka example (login)

Client bhejta hai:

```
POST /api/v1/user/login
{
  "email": "ruchi@mail.com",
  "password": "secret"
}
```

Phir yeh hota hai:

1. **Route** → `/login` pe request aayi, `login` controller ko de di
2. **Controller** → `req.body` se `email, password` nikala, service ko diya
3. **Service** → kaam start: user chahiye email se
4. **Repository** → pool se Postgres ko query: `SELECT ... WHERE email = $1`
5. **Postgres** → user row deti hai (ya kuch nahi)
6. **Repository** → mila toh user, nahi toh `null` — service ko return
7. **Service** → `bcrypt.compare(req wala password, DB wala hash)`
8. **Controller** → result se `res` bhejta hai client ko

---

## Short yaad rakhne wali cheezein

- **Route** = path / endpoint, request yahan aati hai
- **Controller** = `req` lo, `res` do, service choose karo
- **Service** = input lo, output do, req/res se matlab nahi
- **Repository** = DB se baat, pool se connection
- **Postgres** = asal database
- Service independent hai, kai controllers use kar sakte hain
- Controller ke paas req aati hai, service ke paas nahi
- Repository return: mila toh user, nahi mila toh null
- `bcrypt.compare(password, user.password)` = **(req wala, DB wala hash)**

express() → naya app object.
express.json() → JSON body ko req.body banaata hai. Bina iske name, email, password nahi milenge.
GET / → health/test route.
app.use("/api/v1/user", userRouter) → user wale routes is prefix ke neeche lagte hain.
Isliye:

/register actually /api/v1/user/register
/login actually /api/v1/user/login



--------
npm install -D @types/jsonwebtoken  

yha -D why?

-D, d for dependencies

ye package module sirf development ke time kam aate h, jab tk hum kam krteh, jab live ho jaate h tab wha inki need ni hoti, na hi wha ye install hoti, they are only for development.
-------