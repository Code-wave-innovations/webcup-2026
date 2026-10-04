import express from "express";
import settingsController from "../controller/settings.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const settingsRouter = express.Router();

settingsRouter.get("/public", settingsController.getPublic);
settingsRouter.get("/", authenticate, requirePermission("settings.manage"), settingsController.getAll);
settingsRouter.patch("/", authenticate, requirePermission("settings.manage"), settingsController.update);

export default settingsRouter;
