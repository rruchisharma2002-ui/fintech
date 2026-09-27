import crypto from "node:crypto";

export function generateRefreshToken(): string { // generate a refresh token

  return crypto.randomBytes(32).toString("hex");
}
export function hashRefreshToken(token:String):string{
    return crypto 
    .createHash("sha256")
    .update(token as string)
    .digest("hex");
}
// token should be stored in the database as a hash
//pure function = vo functuion jo same input p  same output de  eg     .createHash("sha256") it gives same token for same input.
