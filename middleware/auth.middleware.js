import HttpError from "../utils/HttpError";

import jwt from "jsonwebtoken";

export default (req, res, next) => {
  let authHeader = req.headers.authorization;
  if (!authHeader) {
    next(new HttpError(401, "Unauthorized"));
  }
  let token = authHeader.split(" ")[1];
  if (!token) {
    next(new HttpError(401, "Unauthorized"));
  }

  try {
    let decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (error) {
    next(error);
  }
};
