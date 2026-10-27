import { pool } from "../../config/database.js";
import { AppError } from "../../shared/errors/app.error.js";

export interface  PaymentIntent{
    id: string;
    user_id: string;
    account_id: string;
    idempotency_key: string;
    amount: string;
    currency: string;
    provider_order_id: string | null;
    provider_payment_id: string | null;
    status: "PENDING" | "PAID" | "FAILED";
    created_at: Date;
    updated_at: Date;
};


export async function createPaymentIntent(
    userId: string,
    accountId: string,
    idempotencyKey: string,
    amount: string
): Promise<PaymentIntent> {
const result = await pool.query(
    `INSERT INTO payment_intents(
    user_id,
    account_id,
    idempotency_key,
    amount,
    currency
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (idempotency_key,user_id)
    RETURNING *
    `,
    [userId, accountId, idempotencyKey, amount]
)

if (result.rows.length === 0) {
    throw new AppError(
        409,
        "A payment intent already exists for this idempotency key",
        "PAYMENT_INTENT_DUPLICATE"
    );
}
return result.rows[0]! ;
}


export async function findPaymentIntentById(
    intentId: string,
    userId: string
): Promise<PaymentIntent | null> {

    const result = await pool.query<PaymentIntent>(
        `SELECT *
         FROM payment_intents
         WHERE id = $1 AND user_id = $2`,
        [intentId, userId]
    );
    return result.rows[0] ?? null;}



export async function updatePaymentIntentOrderId(
    intentId: string,
    orderId: string
): Promise<PaymentIntent> {


    const result = await pool.query<PaymentIntent>(
        `UPDATE payment_intents
         SET provider_order_id = $2,
             updated_at = NOW()
         WHERE id = $1
           AND status = 'PENDING'
           AND provider_order_id IS NULL
         RETURNING *`,
        [intentId, orderId]
    );
    
if (result.rows.length === 0) {
    throw new AppError(
        409,
        "Payment intent was not found or already has a provider order",
        "PAYMENT_ORDER_ALREADY_ASSIGNED"
    );
}

return result.rows[0]!;


}
