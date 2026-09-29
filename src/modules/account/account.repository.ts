import { pool } from "../../config/database.js";
import { Account } from "./account.types.js";
// [post]create account for a user by userID
export async function createAccount(
    userId: string,
    type: Account["type"],
    currency: string  //user sends this from the frontend
): Promise<Account> {
    const result = await pool.query<Account>(
        `
        INSERT INTO accounts (
            user_id,
            type,
            currency
        )
        VALUES ($1, $2, $3)
        RETURNING
            id,
            user_id AS "userId",
            account_number AS "accountNumber",
            type,
            currency,
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [userId, type, currency]
    );

    return result.rows[0];
}
// [get] give user by userID
export async function findAccountsByUserId(
    userId: string
): Promise<Account[]> {
    const result = await pool.query<Account>(
        `
        SELECT
            id,
            user_id AS "userId",
            account_number AS "accountNumber",
            type,
            currency,
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM accounts
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId]
    );

    return result.rows;
}

// [get] give account by accountID and userID
export async function findAccountById(
    accountId: string,
    userId: string
): Promise<Account | null> {
    const result = await pool.query<Account>(
        `
        SELECT
            id,
            user_id AS "userId",
            account_number AS "accountNumber",
            type,
            currency,
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM accounts
        WHERE id = $1
          AND user_id = $2
        `,
        [accountId, userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}