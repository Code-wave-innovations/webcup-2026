import express from "express";
import cityServiceController from "../controller/cityService.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const cityServiceRouter = express.Router();

cityServiceRouter.get("/", optionalAuth, cityServiceController.getAll);
cityServiceRouter.get("/:idOrSlug", optionalAuth, cityServiceController.getOne);
cityServiceRouter.post("/", authenticate, requirePermission("catalog.manage"), cityServiceController.create);
cityServiceRouter.patch("/:id", authenticate, requirePermission("catalog.manage"), cityServiceController.update);
cityServiceRouter.delete("/:id", authenticate, requirePermission("catalog.manage"), cityServiceController.delete);

cityServiceRouter.get("/:id/impact", authenticate, requirePermission("interruptions.manage"), cityServiceController.impact);
cityServiceRouter.post("/:id/disable", authenticate, requirePermission("service.cut"), cityServiceController.disable);
cityServiceRouter.post("/:id/enable", authenticate, requirePermission("service.cut"), cityServiceController.enable);

export default cityServiceRouter;
