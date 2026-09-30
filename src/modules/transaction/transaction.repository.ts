import { pool } from "../../config/database.js";
import { Transaction } from "./transaction.types.js";
import { PoolClient } from "pg";

export async function createTransaction(
    type: Transaction["type"], //DEPOSIT, WITHDRAWAL, TRANSFER
    amount: string, //"1000.00"
    currency: string, //INR
    reference?: string //Ruchi sent ₹1 to you
    client?: PoolClient
): Promise<Transaction> { //{id: string, type: Transaction["type"], status: Transaction["status"], amount: string, currency: string, reference: string | null, createdAt: Date}
    const db =client?? pool;
    const result = await pool.query<Transaction>(
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