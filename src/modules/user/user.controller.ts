import { Request, Response } from "express";
export function getUsers(req: Request, res: Response) {
    res.json("User routes are working locally")
}