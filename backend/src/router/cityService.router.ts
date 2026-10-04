import express from "express";
import cityServiceController from "../controller/cityService.controller";
import { authenticate, optionalAuth, requireAdmin, requireStaff } from "../middleware/auth";
const cityServiceRouter = express.Router();

cityServiceRouter.get("/", optionalAuth, cityServiceController.getAll);
cityServiceRouter.get("/:idOrSlug", optionalAuth, cityServiceController.getOne);
cityServiceRouter.post("/", authenticate, requireAdmin, cityServiceController.create);
cityServiceRouter.patch("/:id", authenticate, requireAdmin, cityServiceController.update);
cityServiceRouter.delete("/:id", authenticate, requireAdmin, cityServiceController.delete);
// F63: impact before cutting (staff), cut and restore in one action (admin)
cityServiceRouter.get("/:id/impact", authenticate, requireStaff, cityServiceController.impact);
cityServiceRouter.post("/:id/disable", authenticate, requireAdmin, cityServiceController.disable);
cityServiceRouter.post("/:id/enable", authenticate, requireAdmin, cityServiceController.enable);

export default cityServiceRouter;
