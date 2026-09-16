import { Router } from "express";
import { login, register } from "./user.controller.js";
const userRouter = Router();
userRouter.post("/register",register);
userRouter.post("/login",login); //route on which our request will be sent to login the user
export default userRouter;