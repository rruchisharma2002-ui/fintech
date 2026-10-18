
import test from "node:test";
import assert from "node:assert/strict";
import { pool, withTransaction } from "../src/config/database.js";

test("withTransaction rolls back changes when callback fails", async () => {
    const tableName = `rollback_test_${Date.now()}`;

    try {
        await assert.rejects(
            withTransaction(async (client) => {
                await client.query(`
                    CREATE TEMPORARY TABLE ${tableName} (
                        id INTEGER PRIMARY KEY
                    ) ON COMMIT DROP
                `);

                await client.query(
                    `INSERT INTO ${tableName} (id) VALUES ($1)`,
                    [1]
                );

                throw new Error("Intentional rollback test");
            }),
            /Intentional rollback test/
        );

        // The temporary table was created inside the transaction.
        // Its creation should also have been rolled back.
        const result = await pool.query(
            `SELECT to_regclass($1) AS table_name`,
            [`pg_temp.${tableName}`]
        );

        assert.equal(result.rows[0].table_name, null);
    } finally {
        await pool.end();
    }
});
