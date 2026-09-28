import { Request, Response, NextFunction } from "express";
import { createUserAccount } from "./account.service.js";

export async function createAccountController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { type, currency } = req.body;

        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized",
            });
            return;
        }

        const account = await createUserAccount(
            req.user.userId,
            type,
            currency
        );

        res.status(201).json({account,message:"Account created successfully"});
    } catch (error) {
        next(error);
    }
}