import { createAccount,findAccountsByUserId,findAccountById, decreaseAccountBalance } from "./account.repository.js";
import { Account } from "./account.types.js";
import { withTransaction } from "../../config/database.js";
import { createTransaction,completeTransaction } from "../transaction/transaction.repository.js";
import { createLedgerEntry } from "../ledger/ledger.repository.js";
import { AppError } from "../../shared/errors/app.error.js";
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
            throw new AppError(404, "Account not found");
        }

        // 2. Check account status
        if (account.status !== "ACTIVE") {
            throw new AppError(400, "Account is not active");
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

export async function withdrawMoney(
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
            throw new AppError(404, "Account not found");
        }

        // 2. Check account status
        if (account.status !== "ACTIVE") {
            throw new AppError(400, "Account is not active");
        }

        if (Number(account.balance) < Number(amount)) {
            throw new AppError(400, "Insufficient balance");
        }
        // 3. Create financial transaction
        const transaction = await createTransaction(
            "WITHDRAWAL",
            amount,
            account.currency,
            undefined,
            client
        );

        // 4. Decrease account balance
        await decreaseAccountBalance(
            accountId,
            amount,
            client
        );

        // 5. Create DEBIT ledger entry
        await createLedgerEntry(
            transaction.id,
            accountId,
            "DEBIT",
            amount,
            client
        );

        await completeTransaction(transaction.id, client);

        return transaction;

    });
}
