import { body, param } from "express-validator";

export const registerValidation = [
  body("firstName")
    .notEmpty()
    .withMessage("firstName is Required")
    .isLength({ min: 3 })
    .withMessage("Name must be at least 3 chars")
    .escape(),
  body("email")
    .notEmpty()
    .withMessage("Email is Required")
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .escape(),
  body("password")
    .notEmpty()
    .withMessage("Password is Required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 chars")
    .escape(),
];

export const loginValidator = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .escape(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 chars")
    .escape(),
];
