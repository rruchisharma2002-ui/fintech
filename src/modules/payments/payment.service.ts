import { AppError } from "../../shared/errors/app.error.js";
import { findAccountById, } from "../account/account.repository.js";
import { createPaymentIntent,updatePaymentIntentOrderId } from "./payment.repository.js";
import { razorpay } from "../../config/razorpay.js";
import { env } from "../../config/env.js";

export async function initiatePayment(
    accountId: string,
    userId: string,
    amount: string,
    idempotencyKey: string
) {
    // 1. Find the account and verify ownership
    const account = await findAccountById(accountId, userId);

    if (!account) {
        throw new AppError(404, "Account not found");
    }

    // 2. Ensure the account is active
    if (account.status !== "ACTIVE") {
        throw new AppError(409, "Account is not active");
    }

    // 3. Ensure the account uses INR
    if (account.currency !== "INR") {
        throw new AppError(
            409,
            "Only INR accounts are supported for Razorpay payments"
        );
    }


    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
        throw new AppError(
            400,
            "Amount must be a valid number with at most two decimal places"
        );
    }
    
    if (Number(amount) <= 0) {
        throw new AppError(
            400,
            "Amount must be greater than zero"
        );
    }
    const paymentIntent = await createPaymentIntent(
        userId,
        accountId,
        idempotencyKey,
        amount
    );

    const amountInPaise = rupeesToPaise(amount);

const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: paymentIntent.id,
});
const updatedPaymentIntent = await updatePaymentIntentOrderId(
    paymentIntent.id,
    order.id
);
return {
    paymentIntentId: updatedPaymentIntent.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.razorpay.keyId,
};


}

function rupeesToPaise(amount: string): number {
    const [rupees, paise = ""] = amount.split(".");

    return (
        Number(rupees) * 100 +
        Number(paise.padEnd(2, "0"))
    );
}