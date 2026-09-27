import { Router } from "express";
import { login, register,getMe,refresh,logout } from "./user.controller.js";
import { authenticate } from "./user.middleware.js";
import{registerSchema,loginSchema} from "./user.validation.js";
import { validateBody } from "./user.validation.middleware.js";
const userRouter = Router();
userRouter.post("/register", validateBody(registerSchema), register);
userRouter.post("/login", validateBody(loginSchema), login);
userRouter.get("/me", authenticate, getMe);
userRouter.get("/protected", authenticate, (req, res) => {
    res.json({ message: "You have accessed a protected route!" ,
        userId: req.user?.userId // Access the userId from the authenticated user
    });
});
userRouter.post("/refresh", refresh);
userRouter.post("/logout", logout);
export default userRouter;
//Kaunsa URL kis function pe jaaye

  