import { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import { AuditEvent, AuditResourceType } from "./audit.types.js";

export async function createAuditLog(
    userId: string | null,
    action: string,
    resourceType: AuditResourceType,
    resourceId: string | null,
    details: Record<string, unknown> = {},
    client?: PoolClient,
): Promise<AuditEvent> {
    const db = client ?? pool;
    const result = await db.query<AuditEvent>(
        `
        INSERT INTO audit_logs (
            user_id,
            action,
            resource_type,
            resource_id,
            details
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id,
            user_id AS "userId",
            action,
            resource_type AS "resourceType",
            resource_id AS "resourceId",
            details,
            created_at AS "createdAt"
        `,
        [
            userId,
            action,
            resourceType,
            resourceId,
            JSON.stringify(details)
        ]
    );

    return result.rows[0];
}