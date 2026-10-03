import express from "express";
import authController from "../controller/auth.controller";
import { rateLimit } from "../lib/rateLimit";
const authRouter = express.Router();

// F37: cheap per-IP throttling in front of the DB-backed login guard
authRouter.post("/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), authController.register);
authRouter.post("/login", rateLimit({ windowMs: 60 * 1000, max: 30 }), authController.login);

export default authRouter;
