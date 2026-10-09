import { pool } from "../../config/database.js";
import { Transaction } from "./transaction.types.js";
import { PoolClient } from "pg";

export async function createTransaction(
    type: Transaction["type"], //DEPOSIT, WITHDRAWAL, TRANSFER
    amount: string, //"1000.00"
    currency: string, //INR
    reference?: string, //Ruchi sent ₹1 to you
    client?: PoolClient
): Promise<Transaction> { //{id: string, type: Transaction["type"], status: Transaction["status"], amount: string, currency: string, reference: string | null, createdAt: Date}
    const db = client ?? pool;
    const result = await db.query<Transaction>(
        `
        INSERT INTO transactions (
            type,
            amount,
            currency,
            reference
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            type,
            status,
            amount,
            currency,
            reference,
            created_at AS "createdAt"
        `,
        [type, amount, currency, reference ?? null]
    );

    return result.rows[0];
}
/*createTransaction(
    "TRANSFER",
    "1000.00",
    "INR",
    "Ruchi sent ₹1 to you"
);
the repository performs: //database interaction
Service
   ↓
createTransaction()
   ↓
PostgreSQL
   ↓
transactions table
and PostgreSQL creates:

id:       generated UUID
type:     TRANSFER
status:   PENDING
amount:   1000.00
currency: INR
reference: null
created_at: 2026-09-30T00:00:00.000Z
*/


export async function completeTransaction(
    transactionId: string,
    client: PoolClient
): Promise<Transaction> {
    const result = await client.query<Transaction>(
        `
        UPDATE transactions
        SET status = 'COMPLETED'
        WHERE id = $1
        RETURNING
            id,
            type,
            status,
            amount,
            currency,
            reference,
            created_at AS "createdAt"
        `,
        [transactionId]
    );

    const transaction = result.rows[0];

    if (!transaction) {
        throw new Error("Transaction not found");
    }

    return transaction;
}

export async function findTransactionsByAccountId(
    accountId: string,
    limit: number,
    offset: number
): Promise<unknown[]> {
    const result = await pool.query(
        `
        SELECT
            t.id,
            t.type,
            t.status,
            t.amount,
            t.currency,
            le.entry_type AS "entryType",
            t.created_at AS "createdAt"
        FROM transactions t
        INNER JOIN ledger_entries le
            ON le.transaction_id = t.id
        WHERE le.account_id = $1
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $2
        OFFSET $3
        `,
        [accountId, limit, offset]
    );

    return result.rows;
}

export async function hasMoreTransactions(
    accountId: string,
    offset: number,
    limit: number
): Promise<boolean> {
    const result = await pool.query<{hasMore:boolean}>(
        `
 SELECT EXISTS (
            SELECT 1
            FROM transactions t
            INNER JOIN ledger_entries le
                ON le.transaction_id = t.id
            WHERE le.account_id = $1
            ORDER BY t.created_at DESC, t.id DESC
            OFFSET $2
            LIMIT 1
        ) AS "hasMore"
        `,
        [accountId, offset + limit]
    );

    return result.rows[0].hasMore;
}