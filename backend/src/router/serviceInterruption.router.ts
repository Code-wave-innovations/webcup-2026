import express from "express";
import serviceInterruptionController from "../controller/serviceInterruption.controller";
import { authenticate, optionalAuth, requireStaff } from "../middleware/auth";
const serviceInterruptionRouter = express.Router();

serviceInterruptionRouter.get("/", optionalAuth, serviceInterruptionController.getAll);
serviceInterruptionRouter.post("/", authenticate, requireStaff, serviceInterruptionController.create);
serviceInterruptionRouter.patch("/:id", authenticate, requireStaff, serviceInterruptionController.update);
serviceInterruptionRouter.post("/:id/end", authenticate, requireStaff, serviceInterruptionController.end);
serviceInterruptionRouter.delete("/:id", authenticate, requireStaff, serviceInterruptionController.delete);

export default serviceInterruptionRouter;
