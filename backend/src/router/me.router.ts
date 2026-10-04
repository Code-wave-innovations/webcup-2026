import express from "express";
import meController from "../controller/me.controller";
import meSecurityController from "../controller/meSecurity.controller";
import { authenticate } from "../middleware/auth";
const meRouter = express.Router();

meRouter.use(authenticate);
meRouter.get("/", meController.get);
meRouter.patch("/", meController.update);
meRouter.delete("/", meController.deleteAccount);
meRouter.patch("/password", meController.changePassword);
meRouter.post("/onboarding/complete", meController.completeOnboarding);
// BO-05: own sign-in security (D02, F53, F54)
meRouter.get("/security", meSecurityController.overview);
meRouter.delete("/devices/:id", meSecurityController.forgetDevice);
meRouter.post("/sessions/revoke", meSecurityController.revokeSessions);
meRouter.post("/2fa/setup", meSecurityController.setupTwoFactor);
meRouter.post("/2fa/enable", meSecurityController.enableTwoFactor);
meRouter.post("/2fa/disable", meSecurityController.disableTwoFactor);
meRouter.post("/passkeys/register/options", meSecurityController.passkeyOptions);
meRouter.post("/passkeys/register/verify", meSecurityController.passkeyVerify);
meRouter.get("/passkeys", meSecurityController.passkeys);
meRouter.delete("/passkeys/:id", meSecurityController.deletePasskey);

export default meRouter;
