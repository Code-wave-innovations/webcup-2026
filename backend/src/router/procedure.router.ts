import express from "express";
import procedureController from "../controller/procedure.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const procedureRouter = express.Router();

procedureRouter.get("/", optionalAuth, procedureController.getAll);
procedureRouter.get("/:idOrSlug", optionalAuth, procedureController.getOne);
procedureRouter.post("/", authenticate, requirePermission("catalog.manage"), procedureController.create);
procedureRouter.patch("/:id", authenticate, requirePermission("catalog.manage"), procedureController.update);
procedureRouter.delete("/:id", authenticate, requirePermission("catalog.manage"), procedureController.delete);

export default procedureRouter;
