import express from "express";
import userController from "../controller/user.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const userRouter = express.Router();

userRouter.use(authenticate);

userRouter.get("/staff", requirePermission("requests.process"), userController.staff);
userRouter.get("/stats", requirePermission("staff.manage"), userController.stats);
userRouter.get("/", requirePermission("citizens.manage"), userController.getAll);
userRouter.get("/:id", requirePermission("citizens.manage"), userController.getOne);
userRouter.post("/", requirePermission("staff.manage"), userController.create);
userRouter.patch("/:id", requirePermission("citizens.manage"), userController.update);
userRouter.post("/:id/unlock-login", requirePermission("citizens.manage"), userController.unlockLogin);
userRouter.post("/:id/reset-code", requirePermission("citizens.manage"), userController.issueResetCode);
userRouter.delete("/:id/reset-code", requirePermission("citizens.manage"), userController.cancelResetCode);

userRouter.get("/:id/security", requirePermission("security.manage"), userController.security);
userRouter.get("/:id/devices", requirePermission("security.manage"), userController.devices);
userRouter.post("/:id/revoke-sessions", requirePermission("security.manage"), userController.revokeSessions);
userRouter.post("/:id/2fa/reset", requirePermission("security.manage"), userController.resetTwoFactor);
userRouter.delete("/:id/passkeys", requirePermission("security.manage"), userController.revokePasskeys);

userRouter.delete("/:id", requirePermission("staff.manage"), userController.delete);

export default userRouter;
