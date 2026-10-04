import express from "express";
import serviceCategoryController from "../controller/serviceCategory.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const serviceCategoryRouter = express.Router();

serviceCategoryRouter.get("/", optionalAuth, serviceCategoryController.getAll);
serviceCategoryRouter.get("/:idOrSlug", optionalAuth, serviceCategoryController.getOne);
serviceCategoryRouter.post("/", authenticate, requirePermission("catalog.manage"), serviceCategoryController.create);
serviceCategoryRouter.patch("/:id", authenticate, requirePermission("catalog.manage"), serviceCategoryController.update);
serviceCategoryRouter.delete("/:id", authenticate, requirePermission("catalog.manage"), serviceCategoryController.delete);

export default serviceCategoryRouter;
