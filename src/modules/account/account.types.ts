export type AccountType = "SAVINGS" | "CHECKING";

export type AccountStatus =
    | "ACTIVE"
    | "SUSPENDED"
    | "CLOSED";

export type Account = {
    id: string;
    userId: string;
    accountNumber: string;
    type: AccountType;
    currency: string;
    status: AccountStatus;
    balance: string;
    createdAt: Date;
    updatedAt: Date;
};