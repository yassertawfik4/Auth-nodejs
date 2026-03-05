import {
  registerService,
  loginService,
  refreshTokenService,
  logoutService,
} from "../services/account.service.js";
import HttpError from "../utils/HttpError.js";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req, res, next) => {
  try {
    const user = await registerService(req.body);

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = await loginService(req.body);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions).json({
      message: "Login success",
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const { accessToken, refreshToken: newRefreshToken } =
      await refreshTokenService(refreshToken);
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions).json({
      message: "Token Refreshed",
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};
export const logOut = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new HttpError(400, "No refresh token");
    }
    await logoutService(refreshToken);
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
};
