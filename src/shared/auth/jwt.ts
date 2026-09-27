import jwt from "jsonwebtoken"
import {env} from  "../../config/env.js"
import { AccessTokenPayload } from "./jwt.types.js"

//createAccessToken - create a new access token we define here the payload and the secret and the expiresIn
export function createAccessToken(
    payload:AccessTokenPayload
):string{
  //payload token ke data ko store karna hai
    return jwt.sign(
        payload,
        env.jwt.secret,{
            expiresIn:"1h",
        }
    )
}
//verifyAccessToken - verify the access token we define here the token and the secret
//if the token is valid, we return the payload
//token aya ,usse verify karna hai ,uske baad payload return karna hai
export function verifyAccessToken(
  token: string
): AccessTokenPayload {
  //token aya ,usse verify karna hai ,uske baad payload return karna hai
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