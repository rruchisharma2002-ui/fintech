import { createAccount } from "./account.repository.js";
import { Account } from "./account.types.js";

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

