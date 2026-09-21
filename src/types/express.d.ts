import type{AuthUser}from "../modules/user/user.auth.types.ts";
declare global{
    namespace Express{
        interface Request{
            user?:AuthUser;
        }
    }
}   
export{}