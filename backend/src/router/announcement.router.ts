import express from "express";
import announcementController from "../controller/announcement.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const announcementRouter = express.Router();

announcementRouter.get("/", optionalAuth, announcementController.getAll);
announcementRouter.get("/:id", optionalAuth, announcementController.getOne);
announcementRouter.post("/", authenticate, requirePermission("content.publish"), announcementController.create);
announcementRouter.patch("/:id", authenticate, requirePermission("content.publish"), announcementController.update);
announcementRouter.post("/:id/publish", authenticate, requirePermission("content.publish"), announcementController.publish);
announcementRouter.delete("/:id", authenticate, requirePermission("content.publish"), announcementController.delete);

export default announcementRouter;
