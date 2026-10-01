import { Router } from "express";
import { createAccountController,getAccountsController,getAccountController,depositController } from "./account.controller.js";
import { authenticate } from "../user/user.middleware.js";
import { validateBody } from "../user/user.validation.middleware.js";
import { createAccountSchema, depositSchema } from "./account.validation.js";

const router = Router();

router.post(
    "/", authenticate,validateBody(createAccountSchema), createAccountController
);
router.get(
    "/", authenticate,getAccountsController,createAccountController
);
router.get("/:accountId",authenticate,getAccountController);
router.post(
    "/:accountId/deposit",
    authenticate,
    validateBody(depositSchema),
    depositController
);
export default router;