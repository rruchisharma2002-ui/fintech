import jwt from "jsonwebtoken"
import {env} from  "../../config/env.js"
import { AccessTokenPayload } from "./jwt.types.js"


export function createAccessToken(
    payload:AccessTokenPayload
):string{
    return jwt.sign(
        payload,
        env.jwt.secret,{
            expiresIn:"1h",
        }
    )
}


export function verifyAccessToken(
  token: string
): AccessTokenPayload {
  const decoded = jwt.verify(
    token,
    env.jwt.secret
  );

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.userId !== "string"
  ) {
    throw new Error("Invalid access token payload");
  }

  return {
    userId: decoded.userId,
  };
}
/*payload — data stored in the token.

env.jwt.secret — secret used to sign the token.

expiresIn — token lifetime.*/