import { Request, Response } from "express";
import { registerUser, loginUser,getCurrentUser } from "./user.service.js";

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const user = await registerUser(name, email, password);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await loginUser(email, password);
  if (!user) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }
  res.json(user);
}
export async function getMe(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!req.user || !userId) {
    res.status(401).json({ 
      message: "User not authenticated",
     });
    return;
  }
  const user = await getCurrentUser(userId);
if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(user);
}
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