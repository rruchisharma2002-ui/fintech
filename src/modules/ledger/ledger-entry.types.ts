export type LedgerEntryType =
    | "DEBIT"
    | "CREDIT";

export type LedgerEntry = {
    id: string; //LE001
    transactionId: string; //T001
    accountId: string; //A001
    entryType: LedgerEntryType; //DEBIT, CREDIT
    amount: string; //100
    createdAt: Date; //2026-09-30T00:00:00.000Z
};