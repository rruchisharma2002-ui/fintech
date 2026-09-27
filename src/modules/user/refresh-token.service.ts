/*Service
   │
   ├── generate refresh token
   ├── hash it
   ├── calculate expiration
   └── save hash through repository */
import crypto from "node:crypto";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../shared/auth/refresh-token.js";
import { createAccessToken } from "../../shared/auth/jwt.js";
import {
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
} from "./refresh-token.repository.js";
import { RefreshResponse } from "./refresh-token.types.js";
import { RefreshTokenReuseError } from "../../shared/errors/auth.errors.js";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export async function issueRefreshToken(
  userId: string,
  tokenFamilyId?: string,
): Promise<string> {
  const refreshToken = generateRefreshToken();//actual secret that the client will receive.

  const tokenHash = hashRefreshToken(refreshToken);//hash the token to store in the database.means we are storing the hash of the token in the database.
  const familyId = tokenFamilyId ?? crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() +
    REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );
  //save the hash of the token in the database.
  await createRefreshToken(
    userId,
    tokenHash,
    familyId,
    expiresAt
  );

  return refreshToken;//return to user
}


export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshResponse | null> {
  const tokenHash = hashRefreshToken(refreshToken);

      const storedToken =
        await findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    return null;
  }
  if (storedToken.revokedAt) {
    await revokeRefreshTokenFamily(
      storedToken.tokenFamilyId
    );
  
    throw new RefreshTokenReuseError();
  }
  if (storedToken.expiresAt <= new Date()) {
    return null;
  }

  await revokeRefreshToken(tokenHash);

  const newAccessToken = createAccessToken({
    userId: storedToken.userId,
  });

  const newRefreshToken = await issueRefreshToken(
    storedToken.userId,
    storedToken.tokenFamilyId
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}
//client sends the refresh token to the server and the server checks if the token is valid and not revoked and not expired and then creates a new access token and returns it to the client.

export async function revokeRefreshTokenByValue(
  refreshToken: string
): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);

  await revokeRefreshToken(tokenHash);
}//client sends the hash of the refresh token to the server and the server revokes the token.