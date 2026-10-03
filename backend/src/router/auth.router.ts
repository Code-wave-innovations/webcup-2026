import express from "express";
import authController from "../controller/auth.controller";
import { rateLimit } from "../lib/rateLimit";
const authRouter = express.Router();

// F37: cheap per-IP throttling in front of the DB-backed login guard
authRouter.post("/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), authController.register);
authRouter.post("/login", rateLimit({ windowMs: 60 * 1000, max: 30 }), authController.login);
// Airlock routing: does this e-mail already have an account? (no session)
authRouter.get("/exists", rateLimit({ windowMs: 60 * 1000, max: 60 }), authController.exists);
// Passwordless session after face identify (same body as login)
authRouter.get("/by-email", rateLimit({ windowMs: 60 * 1000, max: 30 }), authController.getByEmail);

export default authRouter;
