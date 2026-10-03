import express from "express";
import alertController from "../controller/alert.controller";
import { authenticate, optionalAuth, requireAdmin, requireStaff } from "../middleware/auth";
const alertRouter = express.Router();

alertRouter.get("/active", optionalAuth, alertController.getActive);
alertRouter.get("/", authenticate, requireStaff, alertController.getAll);
alertRouter.get("/:id", optionalAuth, alertController.getOne);
alertRouter.post("/", authenticate, requireStaff, alertController.create);
alertRouter.patch("/:id", authenticate, requireStaff, alertController.update);
alertRouter.post("/:id/close", authenticate, requireStaff, alertController.close);
alertRouter.delete("/:id", authenticate, requireAdmin, alertController.delete);

export default alertRouter;
