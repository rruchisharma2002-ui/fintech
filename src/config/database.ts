import { Pool,PoolClient } from "pg";
import { env } from "./env.js";

export const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
});

export async function withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>, //callback is a function that takes a client and returns a promise of type T
): Promise<T> { //returns a promise of type T
    const client = await pool.connect(); //connect to the database

    try {
        await client.query("BEGIN"); //begin a transaction

        const result = await callback(client);

        await client.query("COMMIT"); //commit the transaction

        return result;
    } catch (error) {
        await client.query("ROLLBACK"); //rollback the transaction
        throw error;
    } finally {
        client.release(); //release the client
    }
}