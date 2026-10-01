import { pool } from "../../config/database.js";
import { LedgerEntry } from "./ledger-entry.types.js"; //import the types
import { PoolClient } from "pg";
export async function createLedgerEntry(
    transactionId: string, //T001
    accountId: string, //A001
    entryType: LedgerEntry["entryType"], //DEBIT, CREDIT
    amount: string, //"1000.00"
    client?: PoolClient
): Promise<LedgerEntry> {
    const db = client ?? pool;

    const result = await db.query<LedgerEntry>(
        `
        INSERT INTO ledger_entries (
            transaction_id,
            account_id,
            entry_type,
            amount
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            transaction_id AS "transactionId",
            account_id AS "accountId",
            entry_type AS "entryType",
            amount,
            created_at AS "createdAt"
        `,
        [
            transactionId,
            accountId,
            entryType,
            amount
        ]
    );

    return result.rows[0];
}