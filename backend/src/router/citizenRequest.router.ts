import express from "express";
import citizenRequestController from "../controller/citizenRequest.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";
import { rateLimit } from "../lib/rateLimit";

const citizenRequestRouter = express.Router();

citizenRequestRouter.post("/", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), optionalAuth, citizenRequestController.create);
citizenRequestRouter.get("/", authenticate, citizenRequestController.getAll);
citizenRequestRouter.post("/bulk", authenticate, requirePermission("requests.process"), citizenRequestController.bulkUpdate);
citizenRequestRouter.get("/:id", authenticate, citizenRequestController.getOne);
citizenRequestRouter.post("/:id/comments", authenticate, citizenRequestController.addComment);
citizenRequestRouter.patch("/:id", authenticate, requirePermission("requests.process"), citizenRequestController.update);
citizenRequestRouter.delete("/:id", authenticate, requirePermission("requests.delete"), citizenRequestController.delete);

export default citizenRequestRouter;
