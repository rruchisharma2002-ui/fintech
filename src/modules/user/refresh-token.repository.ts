//create a function which will create a refresh token and interact with the database
import { pool } from "../../config/database.js";
import { RefreshToken } from "./refresh-token.types.js";

export async function createRefreshToken(
    userId: string,
    tokenHash: string,
    tokenFamilyId: string,
    expiresAt: Date,
// user sends the token to the server and the server creates a refresh token and stores it in the database
): Promise<RefreshToken> {
  const result = await pool.query<RefreshToken>(
    `
    INSERT INTO refresh_tokens (
      user_id,
      token_hash,
      token_family_id,
      expires_at
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      user_id AS "userId",
      token_hash AS "tokenHash",
      token_family_id AS "tokenFamilyId",
      expires_at AS "expiresAt",
      revoked_at AS "revokedAt",
      created_at AS "createdAt"
    `,
    [userId, tokenHash, tokenFamilyId, expiresAt]
  );
    return result.rows[0];
}
// we hash the token and store it in the database
export async function findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    const result = await pool.query<RefreshToken>(
      `
      SELECT
        id,
        user_id AS "userId",
        token_hash AS "tokenHash",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        created_at AS "createdAt",
        token_family_id AS "tokenFamilyId"
      FROM refresh_tokens
      WHERE token_hash = $1
      `,
      [tokenHash]
    );
  
    if (result.rows.length === 0) {
      return null;
    }
  
    return result.rows[0];
  }
  /*  
  db tokenHash  store kr rha and hum token_hash se save kra rhe aur jb user login krenge to hum token_hash se check krte hai aur agr valid hai to user ko login kr dte hai
  Refresh Token
  │
  ┌────────────┴────────────┐
  ▼                         ▼
generateRefreshToken()      hashRefreshToken()
  │                         │
  │                         ▼
  │                   PostgreSQL
  │                         │
  └───────────────→ repository
  */


export async function revokeRefreshToken(
    tokenHash:string
):Promise<boolean>{
    const result =await pool.query(
        `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE token_hash = $1
          AND revoked_at IS NULL
        `,
        [tokenHash]
      );
      return result.rowCount === 1;
//if the token is revoked, return true, otherwise return false.To revoke a token means to cancel or invalidate a digital security key before it naturally expires
//Find this refresh token, and if it hasn't already been revoked, mark it revoked now.
}

export async function revokeRefreshTokenFamily(
  tokenFamilyId: string
): Promise<void> {
  await pool.query(
    `
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_family_id = $1
      AND revoked_at IS NULL
    `,
    [tokenFamilyId]
  );
}
