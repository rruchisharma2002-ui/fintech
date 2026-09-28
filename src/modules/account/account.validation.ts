import { z } from "zod";
 export const createAccountSchema = z.object({
    type: z.enum(["SAVINGS", "CHECKING"]),
    currency: z
        .string()
        .trim()
        .length(3)
        .toUpperCase(),
 })