import express from "express";
import notificationController from "../controller/notification.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const notificationRouter = express.Router();

notificationRouter.use(authenticate);
notificationRouter.get("/", notificationController.getAll);
notificationRouter.get("/unread-count", notificationController.unreadCount);
notificationRouter.get("/audience", requirePermission("content.publish"), notificationController.audience);
notificationRouter.post("/read-all", notificationController.markAllRead);
notificationRouter.patch("/:id/read", notificationController.markRead);
notificationRouter.delete("/:id", notificationController.delete);

export default notificationRouter;
