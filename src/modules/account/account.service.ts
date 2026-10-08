import {
  createAccount,
  findAccountsByUserId,
  findAccountById,
  decreaseAccountBalance,
} from "./account.repository.js";
import { Account } from "./account.types.js";
import { withTransaction } from "../../config/database.js";
import {
  createTransaction,
  completeTransaction,
} from "../transaction/transaction.repository.js";
import { createLedgerEntry } from "../ledger/ledger.repository.js";
import { AppError } from "../../shared/errors/app.error.js";
import {
  findAccountByIdForUpdate,
  increaseAccountBalance,
} from "./account.repository.js";
import { checkIdempotency } from "../idempotency/idempotency.service.js";
import { updateIdempotencyKey } from "../idempotency/idempotency.repository.js";
export async function createUserAccount(
  userId: string,
  type: Account["type"],
  currency: string,
): Promise<Account> {
  const account = await createAccount(userId, type, currency);
  return account;
}

//Get  the account belonging to this authenticated user.
export async function getUserAccounts(userId: string): Promise<Account[]> {
  return await findAccountsByUserId(userId);
}

//Get  the account by accountID and userID
export async function getUserAccount(
  accountId: string,
  userId: string,
): Promise<Account | null> {
  return await findAccountById(accountId, userId);
}

export async function depositMoney(
  accountId: string,
  userId: string,
  amount: string,
) {
  return await withTransaction(async (client) => {
    // 1. Find and lock the account
    const account = await findAccountByIdForUpdate(accountId, userId, client);

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
      client,
    );

    // 4. Increase account balance
    await increaseAccountBalance(accountId, amount, client);

    // 5. Create CREDIT ledger entry
    await createLedgerEntry(
      transaction.id,
      accountId,
      "CREDIT",
      amount,
      client,
    );

    return await completeTransaction(transaction.id, client);
  });
}

export async function withdrawMoney(
  accountId: string,
  userId: string,
  amount: string,
) {
  return await withTransaction(async (client) => {
    // 1. Find and lock the account
    const account = await findAccountByIdForUpdate(accountId, userId, client);

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
      client,
    );

    // 4. Decrease account balance
    await decreaseAccountBalance(accountId, amount, client);

    // 5. Create DEBIT ledger entry
    await createLedgerEntry(transaction.id, accountId, "DEBIT", amount, client);

    return await completeTransaction(transaction.id, client);
  });
}

export async function transferMoney(
  fromAccountId: string,
  userId: string,
  toAccountId: string,
  amount: string,
  idempotencyKey: string,
) {
  return await withTransaction(async (client) => {
    const idempotency = await checkIdempotency(
      userId,
      idempotencyKey,
      {
        fromAccountId,
        toAccountId,
        amount,
      },
      client,
    );
    if (idempotency.isRetry) {
      const record = idempotency.record;

      if (record.status === "COMPLETED") {
        return record.response;
      }

      if (record.status === "PROCESSING") {
        throw new AppError(
          409,
          "Request with this idempotency key is already being processed",
        );
      }

      if (record.status === "FAILED") {
        throw new AppError(
          409,
          "Previous request with this idempotency key failed",
        );
      }
    }

    // Prevent self-transfer
    if (fromAccountId === toAccountId) {
      throw new AppError(400, "Cannot transfer to the same account");
    }

    // Always lock accounts in the same order
    const accountIds = [fromAccountId, toAccountId].sort();

    const firstAccount = await findAccountByIdForUpdate(
      accountIds[0], //accountIds[0] is the first account in the sorted array
      undefined,
      client,
    );

    const secondAccount = await findAccountByIdForUpdate(
      accountIds[1],
      undefined,
      client,
    );

    if (!firstAccount || !secondAccount) {
      throw new AppError(404, "Account not found");
    }

    // Recover the actual business roles after sorted locking
    //Jo account originally fromAccountId tha, wahi sender hai. aur jo account originally toAccountId tha, wahi receiver hai.
    const sender =
      firstAccount.id === fromAccountId ? firstAccount : secondAccount;

    const receiver =
      firstAccount.id === toAccountId ? firstAccount : secondAccount;

    // Sender must belong to logged-in user
    if (sender.userId !== userId) {
      throw new AppError(403, "Unauthorized");
    }

    // Both accounts must be active
    if (sender.status !== "ACTIVE" || receiver.status !== "ACTIVE") {
      throw new AppError(400, "Both accounts must be active");
    }

    // Sender must have enough money
    if (Number(sender.balance) < Number(amount)) {
      throw new AppError(400, "Insufficient balance");
    }

    // Create transfer transaction
    const transaction = await createTransaction(
      "TRANSFER",
      amount,
      sender.currency,
      undefined,
      client,
    );

    // Debit sender Ab sender se ₹500 minus
    await decreaseAccountBalance(sender.id, amount, client);

    // Credit receiver Ab receiver se ₹500 add
    await increaseAccountBalance(receiver.id, amount, client);

    // Sender ledger entry
    await createLedgerEntry(transaction.id, sender.id, "DEBIT", amount, client);

    // Receiver ledger entry
    await createLedgerEntry(
      transaction.id,
      receiver.id,
      "CREDIT",
      amount,
      client,
    );

    // Mark transaction completed
    const completedTransaction = await completeTransaction(
      transaction.id,
      client,
    );

    await updateIdempotencyKey(
      idempotency.record.id,
      "COMPLETED",
      completedTransaction,
      client,
    );

    return completedTransaction;
  });
}
/*client yahan ek PostgreSQL connection hai, PoolClient. Commit aur rollback yeh khud nahi karta.
   withTransaction usi connection pe BEGIN, COMMIT, aur ROLLBACK chalati hai.*/
