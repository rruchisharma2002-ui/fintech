export type IdempotencyStatus =
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";

export type IdempotencyKey = {
    id: string;
    userId: string;
    key: string;
    requestHash: string;
    status: IdempotencyStatus;
    response: unknown | null;
    createdAt: Date;
};