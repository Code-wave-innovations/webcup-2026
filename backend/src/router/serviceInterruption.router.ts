import express from "express";
import serviceInterruptionController from "../controller/serviceInterruption.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const serviceInterruptionRouter = express.Router();

serviceInterruptionRouter.get("/", optionalAuth, serviceInterruptionController.getAll);
serviceInterruptionRouter.post("/", authenticate, requirePermission("interruptions.manage"), serviceInterruptionController.create);
serviceInterruptionRouter.patch("/:id", authenticate, requirePermission("interruptions.manage"), serviceInterruptionController.update);
serviceInterruptionRouter.post("/:id/end", authenticate, requirePermission("interruptions.manage"), serviceInterruptionController.end);
serviceInterruptionRouter.delete("/:id", authenticate, requirePermission("interruptions.manage"), serviceInterruptionController.delete);

export default serviceInterruptionRouter;
