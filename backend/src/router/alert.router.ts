import express from "express";
import alertController from "../controller/alert.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const alertRouter = express.Router();

alertRouter.get("/active", optionalAuth, alertController.getActive);
alertRouter.get("/", authenticate, requirePermission("content.publish"), alertController.getAll);
alertRouter.get("/:id", optionalAuth, alertController.getOne);
alertRouter.post("/", authenticate, requirePermission("content.publish"), alertController.create);
alertRouter.patch("/:id", authenticate, requirePermission("content.publish"), alertController.update);
alertRouter.post("/:id/close", authenticate, requirePermission("content.publish"), alertController.close);
alertRouter.delete("/:id", authenticate, requirePermission("alerts.delete"), alertController.delete);

export default alertRouter;
