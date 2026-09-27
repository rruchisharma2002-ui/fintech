import { Request, Response } from "express";
import { registerUser, loginUser,getCurrentUser } from "./user.service.js";
import {
  refreshAccessToken,
  revokeRefreshTokenByValue,
} from "./refresh-token.service.js";
import { RefreshTokenReuseError } from "../../shared/errors/auth.errors.js";

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

export async function refresh(
  req: Request,
  res: Response
) {
  const { refreshToken } = req.body;

  if (
    typeof refreshToken !== "string" ||
    refreshToken.length === 0
  ) {
    return res.status(400).json({
      message: "Refresh token is required",
    });
  }

  try {
    const result =
    await refreshAccessToken(refreshToken);

  if (!result) {
    return res.status(401).json({
      message: "Invalid or expired refresh token",
    });
  }

  return res.status(200).json(result);
} catch (error) {
  if (error instanceof RefreshTokenReuseError) {
    return res.status(401).json({
      message: "Refresh token reuse detected",
    });
  }
  throw error;
}
}

export async function logout(
  req: Request,
  res: Response
) {
  const { refreshToken } = req.body;
//to check if the refresh token is valid and not expired
  if (
    typeof refreshToken !== "string" ||
    refreshToken.length === 0
  ) {
    return res.status(400).json({
      message: "Refresh token is required",
    });
  }

  await revokeRefreshTokenByValue(refreshToken);

  return res.status(204).send();
}
//logout krna  token revoke(expire) krke status 204:Logout is successful, and there's nothing useful to return