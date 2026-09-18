import { Request, Response } from "express";
import { registerUser, loginUser } from "./user.service.js";

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
//req /res handles the request and response