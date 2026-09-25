import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AuthUser } from "./user.auth.types.js";
import { verifyAccessToken } from "../../shared/auth/jwt.js";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
  //ye req ka input data aa raha hai, res ka output data jaa raha hai, next function kaam karne ke baad next middleware pe jaane ke liye
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }
  try {
    const payload = verifyAccessToken(token);

    const authUser: AuthUser = {
      userId: payload.userId,
    };

    req.user = authUser;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
