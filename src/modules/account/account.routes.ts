import { Router } from "express";
import { createAccountController } from "./account.controller.js";
import { authenticate } from "../user/user.middleware.js";
import { validateBody } from "../user/user.validation.middleware.js";
import { createAccountSchema } from "./account.validation.js";

const router = Router();

router.post(
    "/", authenticate,validateBody(createAccountSchema), createAccountController
);

export default router;