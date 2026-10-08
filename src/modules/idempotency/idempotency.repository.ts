import { pool } from "../../config/database.js";
import { IdempotencyKey } from "./idempotency.types.js";
import { PoolClient } from "pg";

export async function findIdempotencyKey(
    userId: string,
    key: string,
    client?: PoolClient
): Promise<IdempotencyKey | null> {
    const db = client ?? pool;

    const result = await db.query<IdempotencyKey>(
        `
        SELECT
            id,
            user_id AS "userId",
            key,
            request_hash AS "requestHash",
            status,
            response,
            created_at AS "createdAt"
        FROM idempotency_keys
        WHERE user_id = $1
            AND key = $2
        `,
        [userId, key]
    );

    return result.rows[0] ?? null;
}
export async function createIdempotencyKey(
    userId: string,
    key: string,
    requestHash: string,
    client?: PoolClient
): Promise<IdempotencyKey | null> {
    const db = client ?? pool;

    const result = await db.query<IdempotencyKey>(
        `
        INSERT INTO idempotency_keys (
            user_id,
            key,
            request_hash,
            status
        )
        VALUES ($1, $2, $3, 'PROCESSING')
        ON CONFLICT (user_id,key)
        DO NOTHING
        RETURNING
            id,
            user_id AS "userId",
            key,
            request_hash AS "requestHash",
            status,
            response,
            created_at AS "createdAt"
        `,
        [userId, key, requestHash]
    );

    return result.rows[0] ?? null;
}
export async function updateIdempotencyKey(
    id: string,
    status: "COMPLETED" | "FAILED",
    response: unknown,
    client?: PoolClient
): Promise<void> {
    const db = client ?? pool;

    await db.query(
        `
        UPDATE idempotency_keys
        SET
            status = $1,
            response = $2
        WHERE id = $3
        `,
        [
            status,
            JSON.stringify(response),
            id
        ]
    );
}