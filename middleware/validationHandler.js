import { validationResult } from "express-validator";

import HttpError from "../utils/HttpError.js";

export default (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new HttpError(400, "Validation Error");
    error.errors = errors;
    return next(error);
  }
  next();
};
