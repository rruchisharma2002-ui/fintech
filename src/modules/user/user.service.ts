import { createUser,findUserByEmail} from "./user.repositry.js";
import { User } from "./user.types.js";
import bcrypt from "bcrypt";
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
): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }
  const passwordMatches  = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return null;
  }
  return user;
}

//Password hash / compare, business rules