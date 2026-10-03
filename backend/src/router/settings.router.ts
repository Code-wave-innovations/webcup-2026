import express from "express";
import settingsController from "../controller/settings.controller";
import { authenticate, requireAdmin } from "../middleware/auth";
const settingsRouter = express.Router();

settingsRouter.get("/public", settingsController.getPublic);
settingsRouter.get("/", authenticate, requireAdmin, settingsController.getAll);
settingsRouter.patch("/", authenticate, requireAdmin, settingsController.update);

export default settingsRouter;
