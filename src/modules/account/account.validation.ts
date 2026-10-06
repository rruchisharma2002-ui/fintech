import { z } from "zod";
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
    amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid monetary value")
        .refine(
            (value) => Number(value) > 0,
            "Amount must be greater than zero"
        ),
});
// [post] withdraw money from an account
 export const withdrawSchema = z.object({
    amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid monetary value")
        .refine(
            (value) => Number(value) > 0,
            "Amount must be greater than zero"
        ),
}); 