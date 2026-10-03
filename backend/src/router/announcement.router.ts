import express from "express";
import announcementController from "../controller/announcement.controller";
import { authenticate, optionalAuth, requireStaff } from "../middleware/auth";
const announcementRouter = express.Router();

announcementRouter.get("/", optionalAuth, announcementController.getAll);
announcementRouter.get("/:id", optionalAuth, announcementController.getOne);
announcementRouter.post("/", authenticate, requireStaff, announcementController.create);
announcementRouter.patch("/:id", authenticate, requireStaff, announcementController.update);
announcementRouter.post("/:id/publish", authenticate, requireStaff, announcementController.publish);
announcementRouter.delete("/:id", authenticate, requireStaff, announcementController.delete);

export default announcementRouter;
