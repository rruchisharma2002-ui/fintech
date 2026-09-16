import { Pool } from "pg";
export const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "fincore",
    password: "aarav",
    port: 5432,
});
