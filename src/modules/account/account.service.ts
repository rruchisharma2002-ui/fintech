import { createAccount,findAccountsByUserId,findAccountById } from "./account.repository.js";
import { Account } from "./account.types.js";
import { withTransaction } from "../../config/database.js";
import { createTransaction,completeTransaction } from "../transaction/transaction.repository.js";
import { createLedgerEntry } from "../ledger/ledger.repository.js";
import {
    findAccountByIdForUpdate,
    increaseAccountBalance,
} from "./account.repository.js";
export async function createUserAccount(
    userId: string,
    type: Account["type"],
    currency: string
): Promise<Account> {
    const account =await createAccount(
        userId,
        type,
        currency
    )
    return account;
}

//Get  the account belonging to this authenticated user.
export async function getUserAccounts(
    userId: string
): Promise<Account[]> {
    return await findAccountsByUserId(userId);
}

//Get  the account by accountID and userID
export async function getUserAccount(
    accountId: string,
    userId: string
): Promise<Account | null> {
    return await findAccountById(accountId, userId);
}

export async function depositMoney(
    accountId: string,
    userId: string,
    amount: string
) {
    return await withTransaction(async (client) => {

        // 1. Find and lock the account
        const account = await findAccountByIdForUpdate(
            accountId,
            userId,
            client
        );

        if (!account) {
            throw new Error("Account not found");
        }

        // 2. Check account status
        if (account.status !== "ACTIVE") {
            throw new Error("Account is not active");
        }

        // 3. Create financial transaction
        const transaction = await createTransaction(
            "DEPOSIT",
            amount,
            account.currency,
            undefined,
            client
        );

        // 4. Increase account balance
        await increaseAccountBalance(
            accountId,
            amount,
            client
        );

        // 5. Create CREDIT ledger entry
        await createLedgerEntry(
            transaction.id,
            accountId,
            "CREDIT",
            amount,
            client
        );

        await completeTransaction(transaction.id, client);

        return {
            ...transaction,
            status: "COMPLETED" as const,
        };
    });
}