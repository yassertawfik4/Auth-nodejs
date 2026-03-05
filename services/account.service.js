import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import HttpError from "../utils/HttpError.js";
import RefreshToken from "../models/refreshToken.model.js";
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
  // 1) Access Token
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
  // 2) ReFresh Token
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_JWT_SECRET,
    { expiresIn: "7d" },
  );
  // 3) Save refresh token in DB
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const hashedToken = await bcrypt.hash(refreshToken, 10);
  await RefreshToken.create({
    user: user._id,
    token: hashedToken,
    expiresAt,
  });
  return { accessToken, refreshToken };
};

export const refreshTokenService = async (refreshToken) => {
  if (!refreshToken) {
    throw new HttpError(401, "Refresh token is required");
  }
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);
  } catch (error) {
    throw new HttpError(401, "Invalid refresh token");
  }
  // check that token in db
  const tokens = await RefreshToken.find({ user: payload.id });

  let stored = null;

  for (const t of tokens) {
    const isMatch = await bcrypt.compare(refreshToken, t.token);
    if (isMatch) {
      stored = t;
      break;
    }
  }

  if (!stored) {
    throw new HttpError(401, "Refresh token not found");
  }

  // Check expiration
  if (stored.expiresAt < new Date()) {
    await stored.deleteOne();
    throw new HttpError(401, "Refresh token expired");
  }
  await stored.deleteOne();

  // Create new access token (use payload.id; stored.user is ObjectId, not populated)
  const newAccessToken = jwt.sign({ id: payload.id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
  // Create new refresh token
  const newRefreshToken = jwt.sign(
    { id: payload.id },
    process.env.REFRESH_JWT_SECRET,
    { expiresIn: "7d" },
  );
  const hashedToken = await bcrypt.hash(newRefreshToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    user: payload.id,
    token: hashedToken,
    expiresAt,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutService = async (refreshToken) => {
  if (!refreshToken) return;

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);
  } catch {
    return;
  }

  const tokens = await RefreshToken.find({ user: payload.id });

  for (const t of tokens) {
    const isMatch = await bcrypt.compare(refreshToken, t.token);
    if (isMatch) {
      await t.deleteOne();
      return;
    }
  }
};
