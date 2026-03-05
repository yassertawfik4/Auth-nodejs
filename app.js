import express from "express";
import morgan from "morgan";

import authRouter from "./routes/auth.routes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/ErrorHandler.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use("/account", authRouter);

app.use("/", notFound);
app.use(errorHandler);
export default app;
