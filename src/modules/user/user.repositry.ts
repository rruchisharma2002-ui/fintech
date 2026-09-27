import {pool} from "../../config/database.js";
import { PublicUser, User } from "./user.types.js";
export async function createUser(
    name:string,
    email:string,
    password:string,
):Promise<User>{
    const result =await pool.query<User>(
        `INSERT INTO users (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING 
        id,
        name,
        email,
        password,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
        `,
        [name, email, password]
    );
    return result.rows[0];
}

export async function findUserByEmail(
    email:String

):Promise<User | null>{
    const result =await pool.query<User>(
        `SELECT 
        id,
        name,
        email,
        password,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
        FROM users
        WHERE email = $1`,
        [email]
    );
    if (result.rows.length === 0) {
        return null;
    }
    return result.rows[0];
}


export async function findUserById(
    id:string
):Promise<PublicUser | null>{
    const result =await pool.query<PublicUser>(
        `SELECT 
        id,
        name,
        email
        FROM users
        WHERE id = $1`,
        [id]
    );
    if (result.rows.length === 0) {
        return null;
    }
    return result.rows[0];
}   
//Database SQL