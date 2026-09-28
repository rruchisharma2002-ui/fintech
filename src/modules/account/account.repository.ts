import { pool } from "../../config/database.js";
import { Account } from "./account.types.js";

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