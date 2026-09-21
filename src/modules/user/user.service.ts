import { createUser, findUserByEmail, findUserById } from "./user.repositry.js";
import { LoginResponse, User,PublicUser } from "./user.types.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await createUser(name, email, hashedPassword);
  return user;
}
export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResponse | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return null;
  }
  const accessToken = jwt.sign({ userId: user.id }, env.jwt.secret, {
    expiresIn: "1h",
  });
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    accessToken,
  };
}
//Password hash / compare, business rules


export async function getCurrentUser(userId: string): Promise<PublicUser | null> {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }
  return user;
}   