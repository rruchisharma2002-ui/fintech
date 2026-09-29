import { Request, Response, NextFunction } from "express";
import {
    createUserAccount,
    getUserAccounts,
    getUserAccount,
} from "./account.service.js";

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

        res.status(201).json({ account, message: "Account created successfully" });
    } catch (error) {
        next(error);
    }
}
export async function getAccountsController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized",
            });
            return;
        }

        const accounts = await getUserAccounts(
            req.user.userId //authenticated user's id
        );

        res.status(200).json({
            accounts,
        });
    } catch (error) {
        next(error);
    }
}
// [get] give account by accountID and userID
export async function getAccountController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({
                message: "Unauthorized",
            });
            return;
        }

        const account = await getUserAccount(
            req.params.accountId as string, //accountID comes from the url
            req.user.userId //authenticated user's id comes from the verified JWT.
        );

        if (!account) {
            res.status(404).json({
                message: "Account not found",
            });
            return;
        }

        res.status(200).json({
            account,
        });
    } catch (error) {
        next(error);
    }
}