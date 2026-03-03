import { registerService, loginService } from "../services/account.service.js";

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
    const token = await loginService(req.body);
    res.json({
      message: "Login success",
      token,
    });
  } catch (err) {
    next(err);
  }
};
