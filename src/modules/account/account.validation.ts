import { z } from "zod";




const amountSchema = z
    .string()
    .trim()
    .regex(
       /^(?=.*[1-9])\d+(\.\d{1,2})?$/,
        "Amount must be greater than zero and have at most two decimal places"
    );


export const createAccountSchema = z.object({
    type: z.enum(["SAVINGS", "CHECKING"]),
    currency: z
        .string()
        .trim()
        .length(3)
        .toUpperCase(),
});

// [post] deposit money into an account
export const depositSchema = z.object({
    amount: amountSchema,
});
// [post] withdraw money from an account
export const withdrawalSchema = z.object({
    amount: amountSchema,
});
export const withdrawSchema = withdrawalSchema;

export const transferSchema = z.object({
    toAccountId: z.string().uuid("Invalid receiver account ID"),
    amount: amountSchema,
});

export const accountIdSchema = z.object({
    accountId: z.string().uuid("Invalid account ID"),
});