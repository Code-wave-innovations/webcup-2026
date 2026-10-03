import express from "express";
import procedureController from "../controller/procedure.controller";
import { authenticate, optionalAuth, requireAdmin } from "../middleware/auth";
const procedureRouter = express.Router();

procedureRouter.get("/", optionalAuth, procedureController.getAll);
procedureRouter.get("/:idOrSlug", optionalAuth, procedureController.getOne);
procedureRouter.post("/", authenticate, requireAdmin, procedureController.create);
procedureRouter.patch("/:id", authenticate, requireAdmin, procedureController.update);
procedureRouter.delete("/:id", authenticate, requireAdmin, procedureController.delete);

export default procedureRouter;
