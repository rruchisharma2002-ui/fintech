import { Pool,PoolClient } from "pg";
import { env } from "./env.js";
//group of connections to the database which are managed by the pool
export const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
});
//pool.connect() is a method that returns a promise of a client connection to the database
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