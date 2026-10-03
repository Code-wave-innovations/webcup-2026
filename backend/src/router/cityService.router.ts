import express from "express";
import cityServiceController from "../controller/cityService.controller";
import { authenticate, optionalAuth, requireAdmin } from "../middleware/auth";
const cityServiceRouter = express.Router();

cityServiceRouter.get("/", optionalAuth, cityServiceController.getAll);
cityServiceRouter.get("/:idOrSlug", optionalAuth, cityServiceController.getOne);
cityServiceRouter.post("/", authenticate, requireAdmin, cityServiceController.create);
cityServiceRouter.patch("/:id", authenticate, requireAdmin, cityServiceController.update);
cityServiceRouter.delete("/:id", authenticate, requireAdmin, cityServiceController.delete);

export default cityServiceRouter;
