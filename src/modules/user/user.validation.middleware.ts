import {Request, Response, NextFunction} from "express";
import { z, ZodError, ZodSchema } from "zod";
export function validateBody(schema:ZodSchema) {
    return (req:Request, res:Response, next:NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success){
            return res.status(400).json({
                message:"Validation error", 
                errors:result.error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }))
            });
        }
             req.body = result.data; 
             next(); // Update req.body with the validated data});
        }
}