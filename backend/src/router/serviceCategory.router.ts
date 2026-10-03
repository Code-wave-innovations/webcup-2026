import express from "express";
import serviceCategoryController from "../controller/serviceCategory.controller";
import { authenticate, optionalAuth, requireAdmin } from "../middleware/auth";
const serviceCategoryRouter = express.Router();

serviceCategoryRouter.get("/", optionalAuth, serviceCategoryController.getAll);
serviceCategoryRouter.get("/:idOrSlug", optionalAuth, serviceCategoryController.getOne);
serviceCategoryRouter.post("/", authenticate, requireAdmin, serviceCategoryController.create);
serviceCategoryRouter.patch("/:id", authenticate, requireAdmin, serviceCategoryController.update);
serviceCategoryRouter.delete("/:id", authenticate, requireAdmin, serviceCategoryController.delete);

export default serviceCategoryRouter;
