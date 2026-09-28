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
    createdAt: Date;
    updatedAt: Date;
};