import express from "express";
import authController from "../controller/auth.controller";
import { rateLimit } from "../lib/rateLimit";
const authRouter = express.Router();

// F37: cheap per-IP throttling in front of the DB-backed login guard
authRouter.post("/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), authController.register);
authRouter.post("/login", rateLimit({ windowMs: 60 * 1000, max: 30 }), authController.login);
// Airlock routing: does this e-mail already have an account? (no session)
authRouter.get("/exists", rateLimit({ windowMs: 60 * 1000, max: 60 }), authController.exists);
// D03: face sign-in, checked by the server against the face engine (same body as login)
authRouter.post("/face", rateLimit({ windowMs: 60 * 1000, max: 20 }), authController.face);
// F34: new password with the one-time code an agent handed over
authRouter.post("/recover", rateLimit({ windowMs: 60 * 1000, max: 10 }), authController.recover);

// F53: second step and enforced setup; D02: passkey sign-in
const steps = rateLimit({ windowMs: 60 * 1000, max: 30 });
authRouter.post("/2fa/verify", steps, authController.verifyTwoFactor);
authRouter.post("/2fa/setup", steps, authController.setupTwoFactor);
authRouter.post("/2fa/activate", steps, authController.activateTwoFactor);
authRouter.post("/passkey/options", steps, authController.passkeyOptions);
authRouter.post("/passkey/verify", steps, authController.passkeyVerify);

export default authRouter;
