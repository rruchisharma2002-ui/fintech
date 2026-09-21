import {Request,Response,NextFunction} from "express";
import jwt from "jsonwebtoken";
import {env} from "../../config/env.js";
import { AuthUser } from "./user.auth.types.js";
export function  authenticate(
    req:Request,
    res:Response,
    next:NextFunction
    //ye req ka input data aa raha hai, res ka output data jaa raha hai, next function kaam karne ke baad next middleware pe jaane ke liye
){
    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({message:"Authentication required"});
    }

    const token = authHeader.split(" ")[1];
 try{
    const decoded = jwt.verify(token,env.jwt.secret);
   
   if (
    typeof decoded !== 'object' || 
 decoded === null ||
    typeof decoded.userId !== 'string')
     {
    
    return res.status(401).json
    ({message:"Invalid token payload"});
 }

    const authUser:AuthUser =
     {userId:decoded.userId};
    req.user = authUser;
    next();}
 catch(err){
    console.error("Token verification error:",err);
    return res.status(401).json({message:"Invalid token"});
 }
}