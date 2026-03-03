import { Router } from "express";

import { register, login } from "../controllers/account.controller.js";
import {
  loginValidator,
  registerValidation,
} from "../middleware/user.validator.js";
import validationHandler from "../middleware/validationHandler.js";

const router = Router();

router.post("/register", registerValidation, validationHandler, register);
router.post("/login", loginValidator, validationHandler, login);

export default router;
