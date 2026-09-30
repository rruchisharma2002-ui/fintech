import { createLedgerEntry } from "./ledger.repository.js";
import { LedgerEntry } from "./ledger-entry.types.js";

export async function createLedgerEntryService(
    transactionId: string,
    accountId: string,
    entryType: LedgerEntry["entryType"],
    amount: string
): Promise<LedgerEntry> {
    return await createLedgerEntry(
        transactionId,
        accountId,
        entryType,
        amount
    );
}