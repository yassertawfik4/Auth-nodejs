import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import HttpError from "../utils/HttpError.js";

export const registerService = async ({ firstName, email, password }) => {
  const exist = await User.findOne({ email });
  if (exist) {
    throw new HttpError(400, "User already exists");
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    firstName,
    email,
    password: hashed,
  });

  return user;
};

export const loginService = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(400, "Invalid email or password");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new HttpError(400, "Invalid email or password");
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  return token;
};
