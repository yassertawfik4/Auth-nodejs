import { Router } from "express";

import {
  register,
  login,
  refresh,
  logOut,
} from "../controllers/account.controller.js";
import {
  loginValidator,
  registerValidation,
} from "../middleware/user.validator.js";
import validationHandler from "../middleware/validationHandler.js";

const router = Router();

router.post("/register", registerValidation, validationHandler, register);
router.post("/login", loginValidator, validationHandler, login);
router.post("/refresh", refresh);
router.post("/logout", logOut);

export default router;
