export type AuditResourceType =
    | "USER"
    | "ACCOUNT"
    | "TRANSACTION";

export type AuditEvent = {
    id: string;
    userId: string | null;
    action: string;
    resourceType: AuditResourceType;
    resourceId: string | null;
    details: Record<string, unknown>;
    createdAt: Date;
};