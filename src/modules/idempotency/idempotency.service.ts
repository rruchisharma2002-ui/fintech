import {
  findIdempotencyKey,
  createIdempotencyKey,
} from "./idempotency.repository.js";
import { generateRequestHash } from "./idempotency.utils.js";
import { PoolClient } from "pg";
import type { IdempotencyKey } from "./idempotency.types.js";
import { AppError } from "../../shared/errors/app.error.js";

export async function checkIdempotency(
  userId: string,
  key: string,
  requestData: unknown,
  client?: PoolClient,
){
  const requestHash = generateRequestHash(requestData);

  // 1. Check whether the key already exists
  const existing = await findIdempotencyKey(userId, key, client);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        409,
        "Idempotency key already used for a different request",
      );
    }
    return {
      isRetry: true,
      record: existing,
    };
  }

  // 2. Try to create the key
  const created = await createIdempotencyKey(userId, key, requestHash, client);

  // 3. Another concurrent request may have created it first
  if (!created) {
    const concurrent = await findIdempotencyKey(userId, key, client);

    if (!concurrent) {
      throw new Error("Unable to create or find idempotency key");
    }

    if (concurrent.requestHash !== requestHash) {
      throw new AppError(
        409,
        "Idempotency key already used for a different request",
      );
    }

    return {
      isRetry: true,
      record: concurrent,
    };
  }

  // 4. We created it, so this is a new request

  return {
    isRetry: false,
    record: created,
  };
}
