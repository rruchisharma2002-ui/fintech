import { createTransaction } from "./transaction.repository.js";
import { Transaction } from "./transaction.types.js";
import { findAccountById } from "../account/account.repository.js";
import { findTransactionsByAccountId } from "./transaction.repository.js";
import { AppError } from "../../shared/errors/app.error.js";
import { hasMoreTransactions } from "./transaction.repository.js";

export async function createPendingTransaction(
    type: Transaction["type"], //DEPOSIT, WITHDRAWAL, TRANSFER
    amount: string, //"1000.00"
    currency: string, //INR
    reference?: string //Ruchi sent ₹1 to you
): Promise<Transaction> { //{id: string, type: Transaction["type"], status: Transaction["status"], amount: string, currency: string, reference: string | null, createdAt: Date}
    const transaction = await createTransaction(type, amount, currency, reference);
    return transaction;
}
//The service calls:createTransaction() repository function
//The repository function performs: database interaction
//The database interaction creates: a new transaction record in the transactions table
//The service returns: the new transaction record
/*
create a pending transaction means for status pending
createPendingTransaction(
    "TRANSFER",
    "1000.00",
    "INR",
    "Ruchi sent ₹1 to you"
);*/

export async function getAccountTransactionHistory(
    accountId: string,
    userId: string,
    limit: number,
    offset: number
) {
    const account = await findAccountById(accountId, userId);

    if (!account) {
        throw new AppError(404, "Account not found");
    }

    const transactions = await findTransactionsByAccountId(
        accountId,
        limit,
        offset
    );

    const hasMore = await hasMoreTransactions(
        accountId,
        offset,
        limit
    );

    return {
        transactions,
        pagination: {
            limit,
            offset,
            hasMore,
        },
    };
}