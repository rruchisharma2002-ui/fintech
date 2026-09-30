export type TransactionType =
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "TRANSFER";

export type TransactionStatus =
    | "PENDING"
    | "COMPLETED"
    | "FAILED"
    | "REVERSED";

export type Transaction = {
    id: string; //T001
    type: TransactionType; //DEPOSIT, WITHDRAWAL, TRANSFER
    status: TransactionStatus; //PENDING, COMPLETED, FAILED, REVERSED
    amount: string; //100
    currency: string; //INR
    reference: string | null; //Ruchi sent ₹1 to you
    createdAt: Date; //2026-09-30T00:00:00.000Z
};
//Transaction: Records what event happened — e.g., Ruchi sent ₹1 to you.
//Ledger: Records the financial effect of that event — Ruchi DEBIT ₹1, you CREDIT ₹1.
//""=string