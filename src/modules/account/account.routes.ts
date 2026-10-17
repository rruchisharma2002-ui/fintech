import { Router } from "express";
import { 
    createAccountController, 
    getAccountsController, 
    getAccountController, 
    depositController, 
    withdrawController, 
    transferController 
} from "./account.controller.js";
import { authenticate } from "../user/user.middleware.js";
import { validateBody, validateParams } from "../user/user.validation.middleware.js";
import { 
    createAccountSchema,
    accountIdSchema,
    depositSchema, 
    transferSchema, 
    withdrawalSchema 
} from "./account.validation.js";
import { getAccountTransactionController } from "./account.controller.js";

const router = Router();

router.post("/", authenticate, validateBody(createAccountSchema), createAccountController);
router.get("/", authenticate, getAccountsController);
router.get("/:accountId", authenticate, validateParams(accountIdSchema), getAccountController);
router.post("/:accountId/deposit", authenticate, validateParams(accountIdSchema), validateBody(depositSchema), depositController);
router.post("/:accountId/withdraw", authenticate, validateParams(accountIdSchema), validateBody(withdrawalSchema), withdrawController);
router.post("/:accountId/transfer", authenticate, validateParams(accountIdSchema), validateBody(transferSchema), transferController);
router.get("/:accountId/transactions", authenticate, validateParams(accountIdSchema), getAccountTransactionController);

export default router;