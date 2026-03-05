# Auth API – Project Documentation

A Node.js (Express) REST API for user **registration**, **login**, **refresh token**, and **logout**, with JWT access tokens, httpOnly cookie refresh tokens, and MongoDB persistence.

---

## Table of Contents

1. [Project structure](#1-project-structure)
2. [How pieces connect](#2-how-pieces-connect)
3. [Request lifecycle](#3-request-lifecycle)
4. [File-by-file reference](#4-file-by-file-reference)
5. [API endpoints](#5-api-endpoints)
6. [Environment variables](#6-environment-variables)

---

## 1. Project structure

```
Auth/
├── server.js                 # Entry point: loads env, connects DB, starts Express
├── app.js                     # Express app: middleware + routes (no listen)
├── config/
│   └── database.js            # MongoDB connection
├── routes/
│   └── auth.routes.js         # Account routes: register, login, refresh, logout
├── controllers/
│   └── account.controller.js # HTTP layer: req/res, calls services, sets cookies
├── services/
│   └── account.service.js     # Business logic: auth, tokens, DB
├── models/
│   ├── user.model.js         # User schema (Mongoose)
│   └── refreshToken.model.js # RefreshToken schema (Mongoose)
├── middleware/
│   ├── user.validator.js     # express-validator rules for register/login
│   ├── validationHandler.js   # Checks validation result, passes errors to next()
│   ├── auth.middleware.js     # JWT auth (optional, for protected routes)
│   ├── ErrorHandler.js        # Global error handler (JSON response)
│   └── notFound.js            # 404 handler
├── utils/
│   └── HttpError.js           # Custom error class (status + message)
├── .env                       # PORT, MONGO_URL, JWT_SECRET, REFRESH_JWT_SECRET
├── package.json
└── README.md
```

- **Entry**: `server.js` → loads env, connects DB, then passes control to `app.js` for `app.listen()`.
- **Routing**: All account actions live under `/account` and are defined in `auth.routes.js`.
- **Layers**: Route → Controller → Service → Model (and middleware in between).

---

## 2. How pieces connect

- **server.js**  
  - Imports `app` from `app.js` and `connectDB` from `config/database.js`.  
  - Calls `connectDB()` then `app.listen(PORT)`.

- **app.js**  
  - Uses global middleware (morgan, json, cookie-parser), then mounts `authRouter` at `/account`, then 404 handler, then error handler.  
  - So every request goes: middleware → `/account` routes (if path matches) → notFound → errorHandler if something called `next(err)`.

- **auth.routes.js**  
  - Imports controllers and validator middleware.  
  - Defines POST `/register`, `/login`, `/refresh`, `/logout` and chains: validators (for register/login) → `validationHandler` → controller.  
  - Controllers are in `account.controller.js`.

- **account.controller.js**  
  - Receives `req`/`res`, reads body or cookies, calls `account.service.js` functions, and sends HTTP responses (and sets/clears refresh cookie).

- **account.service.js**  
  - Uses `User` and `RefreshToken` models, `bcrypt`, `jwt`, and `HttpError`.  
  - Implements register, login, refresh, logout; no access to `req`/`res`.

- **Models**  
  - Used only by services (and config by server).  
  - No direct connection to routes or controllers.

- **Middleware**  
  - **user.validator.js**: Adds validation rules to the request (express-validator).  
  - **validationHandler.js**: Reads validation result; if invalid, calls `next(HttpError)` with `errors` attached.  
  - **ErrorHandler.js**: Central place that turns any `next(err)` into a JSON response.  
  - **notFound.js**: Sends 404 JSON when no route matched.  
  - **auth.middleware.js**: Can be used on routes that require a valid JWT (not currently used in the provided routes).

---

## 3. Request lifecycle

### Example: `POST /account/register`

1. **server.js**  
   - Already running; request is handled by the Express app.

2. **app.js**  
   - `morgan("dev")`: logs the request.  
   - `express.json()`: parses body into `req.body`.  
   - `cookieParser()`: parses cookies into `req.cookies`.  
   - Path is `/account/register` → forwarded to `authRouter` (mounted at `/account`).

3. **auth.routes.js**  
   - Route: `POST "/register"` → runs `registerValidation` → `validationHandler` → `register`.  
   - **registerValidation**: express-validator runs on `req.body` (firstName, email, password) and attaches errors to the request.  
   - **validationHandler**: `validationResult(req)`. If there are errors, creates `HttpError(400, "Validation Error")`, attaches `errors`, calls `return next(error)` and stops.  
   - If validation passed, **register** controller runs.

4. **account.controller.js – register**  
   - `registerService(req.body)` is called.  
   - On success: `res.status(201).json({ message, user })`.  
   - On error: `next(err)`.

5. **account.service.js – registerService**  
   - Checks if user exists by email; if yes, throws `HttpError(400, "User already exists")`.  
   - Hashes password with bcrypt, creates user with `User.create()`, returns user.  
   - Any thrown error propagates to controller → `next(err)`.

6. **Back in app.js**  
   - If no one called `next(err)`, the response has already been sent by the controller.  
   - If `next(err)` was called, request reaches **errorHandler** (middleware with 4 args).

7. **ErrorHandler.js**  
   - Sets `status`, `message`, `errors` from `err`.  
   - Handles Mongoose `ValidationError` and duplicate key (11000).  
   - Sends `res.status(status).json({ message, errors })`.

### Example: `POST /account/login`

1. Same app middleware (morgan, json, cookieParser).  
2. Route: `loginValidator` → `validationHandler` → `login`.  
3. **login** controller: calls `loginService(req.body)`, gets `{ accessToken, refreshToken }`.  
4. Service: finds user, compares password, creates access + refresh JWTs, stores hashed refresh token in DB with `RefreshToken.create()`, returns both tokens.  
5. Controller: sets `refreshToken` in an httpOnly cookie (using `refreshCookieOptions`), sends JSON with `accessToken` only.  
6. Any error from service → `next(err)` → ErrorHandler.

### Example: `POST /account/refresh`

1. No body validation; route runs only `refresh` controller.  
2. **refresh**: reads `req.cookies.refreshToken`, calls `refreshTokenService(refreshToken)`.  
3. Service: verifies JWT with `REFRESH_JWT_SECRET`, finds matching token in DB (by user + bcrypt compare), checks expiry, deletes old refresh token, creates new access + refresh tokens, stores new hashed refresh token, returns both.  
4. Controller: sets new refresh token in cookie, sends JSON with new `accessToken`.  
5. If cookie is missing or token invalid/expired, service throws → `next(err)` → ErrorHandler.

### Example: `POST /account/logout`

1. **logOut** controller: reads `req.cookies.refreshToken`.  
2. If missing: throws `HttpError(400, "No refresh token")` → `next(err)` → ErrorHandler.  
3. Otherwise: `logoutService(refreshToken)` finds and deletes the refresh token document, then controller clears the cookie and sends success JSON.

### Flow summary

- **Request** → app middleware → route middleware (validators + validationHandler) → controller → service → model (DB).  
- **Response** → controller sends JSON (and cookies) **or** calls `next(err)`.  
- **Error** → ErrorHandler sends JSON with status and message/errors.

---

## 4. File-by-file reference

### server.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import app from "./app.js";` | Express app (middleware + routes), no listen. |
| 2–3 | `import dotenv from "dotenv"; dotenv.config();` | Loads `.env` into `process.env`. |
| 5–6 | `import connectDB from "./config/database.js"; await connectDB();` | Connects to MongoDB before accepting requests. |
| 8 | `const PORT = process.env.PORT;` | Port from env (e.g. 5000). |
| 9–11 | `app.listen(PORT, () => { ... });` | Starts HTTP server; callback logs that server is running. |

---

### app.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–2 | `import express from "express"; import morgan from "morgan";` | Express app and request logger. |
| 4–7 | Imports `authRouter`, `notFound`, `errorHandler`, `cookieParser` | Routers and middleware. |
| 9 | `const app = express();` | Creates Express application. |
| 11 | `app.use(morgan("dev"));` | Logs each request (method, URL, status, time) in dev format. |
| 12 | `app.use(express.json());` | Parses `Content-Type: application/json` body into `req.body`. |
| 13 | `app.use(cookieParser());` | Parses `Cookie` header into `req.cookies`. |
| 15 | `app.use("/account", authRouter);` | All routes in `auth.routes.js` are under `/account`. |
| 17 | `app.use("/", notFound);` | Any path not handled above gets 404 JSON. |
| 18 | `app.use(errorHandler);` | Four-arg middleware: catches errors passed to `next(err)` and sends JSON. |
| 19 | `export default app;` | So `server.js` can import and call `app.listen()`. |

---

### config/database.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import mongoose from "mongoose";` | MongoDB ODM. |
| 3 | `export default async () => { ... }` | Exported async function (no name) to connect to DB. |
| 5 | `const MONGO_URL = process.env.MONGO_URL;` | Connection string from env. |
| 6–8 | `await mongoose.connect(MONGO_URL, { dbName: "UserAuth" });` | Connects and uses database name `UserAuth`. |
| 9 | `console.log("Connected to MongoDB");` | Logs success. |
| 10–12 | `catch (error) { ... throw error; }` | Logs failure and rethrows so server can exit or handle. |

---

### routes/auth.routes.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import { Router } from "express";` | Express router to define routes. |
| 3–8 | Import `register`, `login`, `refresh`, `logOut` from controller | Controller functions for each route. |
| 9–13 | Import `loginValidator`, `registerValidation`, `validationHandler` | Validators and validation middleware. |
| 15 | `const router = Router();` | New router instance. |
| 17 | `router.post("/register", registerValidation, validationHandler, register);` | POST `/account/register`: validate body → check result → register. |
| 18 | `router.post("/login", loginValidator, validationHandler, login);` | POST `/account/login`: same pattern. |
| 19 | `router.post("/refresh", refresh);` | POST `/account/refresh`: no validation; reads cookie in controller. |
| 20 | `router.post("/logout", logOut);` | POST `/account/logout`: same; cookie read in controller. |
| 22 | `export default router;` | Mounted in `app.js` as `authRouter`. |

---

### controllers/account.controller.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–7 | Imports services and `HttpError` | Services do the logic; HttpError for structured errors. |
| 9–14 | `refreshCookieOptions` | Options for setting/clearing refresh cookie: httpOnly, secure in production, sameSite, 7-day maxAge. |
| 16–29 | `register` | Calls `registerService(req.body)`; on success responds 201 with user id/email; on error `next(err)`. |
| 31–41 | `login` | Gets `accessToken` and `refreshToken` from service; sets cookie with `refreshToken`, responds with `accessToken` only. |
| 43–54 | `refresh` | Reads `req.cookies.refreshToken`, calls `refreshTokenService`, sets new refresh cookie and returns new `accessToken`. |
| 56–68 | `logOut` | Reads cookie; if missing throws HttpError(400); else calls `logoutService`, clears cookie, sends success. |

---

### services/account.service.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–5 | Imports bcrypt, jwt, User, HttpError, RefreshToken | Dependencies for hashing, tokens, and DB. |
| 6–21 | `registerService` | Finds existing user by email; hashes password; creates user; returns user (or throws HttpError). |
| 23–52 | `loginService` | Finds user, compares password; creates access (15m) and refresh (7d) JWTs; hashes refresh token and saves to RefreshToken collection with `user`, `token`, `expiresAt`; returns `{ accessToken, refreshToken }`. |
| 54–113 | `refreshTokenService` | Ensures token present; verifies JWT with REFRESH_JWT_SECRET; finds stored token by user and bcrypt compare; if expired deletes and throws; else deletes old token, creates new access + refresh, saves new hashed refresh token; returns both tokens. |
| 115–134 | `logoutService` | If no token returns; verifies JWT; finds token in DB by user + bcrypt compare; deletes that document. |

---

### models/user.model.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import mongoose from "mongoose";` | ODM. |
| 3–18 | `user_Schema` | Schema: `firstName` (required string), `email` (required, unique, regex), `password` (required string); `timestamps: true` adds createdAt/updatedAt. |
| 20 | `export default mongoose.model("User", user_Schema, "user");` | Model named "User", collection name "user". |

---

### models/refreshToken.model.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import mongoose from "mongoose";` | ODM. |
| 3–20 | `refreshToken_schema` | Schema: `user` (ObjectId ref "User"), `token` (string, hashed), `expiresAt` (Date); timestamps. |
| 22 | `export default mongoose.model("RefreshToken", refreshToken_schema);` | Model "RefreshToken"; collection name will be "refreshtokens" (Mongoose default). |

---

### middleware/user.validator.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import { body } from "express-validator";` | Validators for request body. |
| 3–22 | `registerValidation` | firstName: notEmpty, min length 3, escape; email: notEmpty, trim, isEmail, escape; password: notEmpty, min length 6, escape. |
| 24–39 | `loginValidator` | email: notEmpty, trim, isEmail, escape; password: notEmpty, min 6, escape. |

---

### middleware/validationHandler.js

| Line | Code | Explanation |
|------|------|-------------|
| 1 | `import { validationResult } from "express-validator";` | Gets validation result from request. |
| 3 | `import HttpError from "../utils/HttpError.js";` | Custom error with status and message. |
| 5–13 | Default export function | Runs `validationResult(req)`; if errors exist, creates HttpError(400), attaches `errors`, calls `return next(error)`; otherwise calls `next()`. |

---

### middleware/auth.middleware.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–3 | Imports HttpError and jwt | For 401 and token verification. |
| 5–21 | Default export | Reads `req.headers.authorization`; if missing or no "Bearer &lt;token&gt;", calls next(HttpError(401)); else verifies token with JWT_SECRET and sets `req.user = decodedToken`; on verify failure calls next(error). |

Note: This file is not used in the current routes; you can add it to any route that must require a valid access token.

---

### middleware/ErrorHandler.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–5 | Signature and defaults | `(error, req, res, next)`; sets status from error.status or 500, message from error.message or generic, errors from error.errors. |
| 7–14 | Mongoose ValidationError | If `error.name === "ValidationError"`, sets status 400 and maps Mongoose errors to `{ field, message }`. |
| 16–22 | Duplicate key (11000) | If MongoDB duplicate key, sets status 400 and message like "email with x already exist". |
| 24–27 | Response | Sends `res.status(status).json({ message, errors })`. |

---

### middleware/notFound.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–6 | Default export | Sets status 404 and sends JSON `{ status: "fail", msg: "EndPoint Not Found" }`. |
| 8 | `export default notFound;` | Used in app as catch-all route. |

---

### utils/HttpError.js

| Line | Code | Explanation |
|------|------|-------------|
| 1–6 | Class HttpError extends Error | Constructor takes `status` and `message`; calls `super(message)` and sets `this.status = status` so ErrorHandler can use them. |

---

## 5. API endpoints

| Method | Path | Body / Cookie | Description |
|--------|------|----------------|-------------|
| POST | `/account/register` | JSON: `firstName`, `email`, `password` | Create user; response: user id and email. |
| POST | `/account/login` | JSON: `email`, `password` | Login; response: `accessToken`; refresh token in httpOnly cookie. |
| POST | `/account/refresh` | Cookie: `refreshToken` | New access token and new refresh token (cookie updated). |
| POST | `/account/logout` | Cookie: `refreshToken` | Invalidates refresh token and clears cookie. |

All errors return JSON: `{ message, errors? }` with appropriate status code (400, 401, 404, 500).

---

## 6. Environment variables

Create a `.env` file (and do not commit it):

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (e.g. 5000). |
| `MONGO_URL` | MongoDB connection string. |
| `JWT_SECRET` | Secret for signing/verifying access tokens. |
| `REFRESH_JWT_SECRET` | Secret for signing/verifying refresh tokens. |

Optional:

- `NODE_ENV=production` so the refresh cookie uses `secure: true` (HTTPS only).

---

## Quick start

```bash
npm install
# Create .env with PORT, MONGO_URL, JWT_SECRET, REFRESH_JWT_SECRET
npm run dev
```

- Register: `POST /account/register` with JSON body.  
- Login: `POST /account/login` with JSON body; store the returned `accessToken` and send the cookie for refresh/logout.  
- Refresh: `POST /account/refresh` with the refresh cookie.  
- Logout: `POST /account/logout` with the refresh cookie.

This README describes every file, how they connect, and the full request lifecycle for the Auth API.
