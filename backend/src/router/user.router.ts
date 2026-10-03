import express from "express";
import userController from "../controller/user.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";
const userRouter = express.Router();

// Agents manage citizen accounts only (F34); the controller enforces the scope.
userRouter.use(authenticate, requireStaff);
userRouter.get("/", userController.getAll);
userRouter.get("/:id", userController.getOne);
userRouter.post("/", requireAdmin, userController.create);
userRouter.patch("/:id", userController.update);
userRouter.post("/:id/unlock-login", userController.unlockLogin);
userRouter.delete("/:id", userController.delete);

export default userRouter;
