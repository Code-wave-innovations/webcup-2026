import express from "express";
import userController from "../controller/user.controller";
import { authenticate, requireAdmin } from "../middleware/auth";
const userRouter = express.Router();

userRouter.use(authenticate, requireAdmin);
userRouter.get("/", userController.getAll);
userRouter.get("/:id", userController.getOne);
userRouter.post("/", userController.create);
userRouter.patch("/:id", userController.update);
userRouter.delete("/:id", userController.delete);

export default userRouter;
