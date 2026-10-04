import express from "express";
import userController from "../controller/user.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";
const userRouter = express.Router();

// Agents manage citizen accounts only (F34); the controller enforces the scope.
userRouter.use(authenticate, requireStaff);
userRouter.get("/", userController.getAll);
userRouter.get("/staff", userController.staff);
userRouter.get("/stats", requireAdmin, userController.stats);
userRouter.get("/:id", userController.getOne);
userRouter.post("/", requireAdmin, userController.create);
userRouter.patch("/:id", userController.update);
userRouter.post("/:id/unlock-login", userController.unlockLogin);
// F34: one-time code so that the person sets a new password themselves
userRouter.post("/:id/reset-code", userController.issueResetCode);
userRouter.delete("/:id/reset-code", userController.cancelResetCode);
// BO-05: sign-in security of an account (admin)
userRouter.get("/:id/security", requireAdmin, userController.security);
userRouter.get("/:id/devices", requireAdmin, userController.devices);
userRouter.post("/:id/revoke-sessions", requireAdmin, userController.revokeSessions);
userRouter.post("/:id/2fa/reset", requireAdmin, userController.resetTwoFactor);
userRouter.delete("/:id/passkeys", requireAdmin, userController.revokePasskeys);
// F34: deleting an account cannot be undone: admins only (the holder deletes their own from « Mon compte », F33)
userRouter.delete("/:id", requireAdmin, userController.delete);

export default userRouter;
