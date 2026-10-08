import crypto from "crypto";

export function generateRequestHash(
    data: unknown
): string {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
}