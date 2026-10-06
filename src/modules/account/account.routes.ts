import { Router } from "express";
import { createAccountController, getAccountsController, getAccountController, depositController, withdrawController } from "./account.controller.js";
import { authenticate } from "../user/user.middleware.js";
import { validateBody } from "../user/user.validation.middleware.js";
import { createAccountSchema, depositSchema, withdrawSchema } from "./account.validation.js";

const router = Router();

router.post(
    "/", authenticate, validateBody(createAccountSchema), createAccountController
);
router.get(
    "/", authenticate, getAccountsController
);
router.get(
    "/:accountId", authenticate, getAccountController
);
router.post(
    "/:accountId/deposit",
    authenticate,
    validateBody(depositSchema),
    depositController
);
router.post(
    "/:accountId/withdraw",
    authenticate,
    validateBody(withdrawSchema),
    withdrawController
);
export default router;