import express from "express";
import citizenRequestController from "../controller/citizenRequest.controller";
import { authenticate, optionalAuth, requireAdmin, requireStaff } from "../middleware/auth";
import { rateLimit } from "../lib/rateLimit";
const citizenRequestRouter = express.Router();

// optionalAuth: visitors can send a CONTACT request (D04).
// Anonymous CONTACT is further guarded in the controller (honeypot, soft Turnstile, hard limits).
citizenRequestRouter.post("/", rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), optionalAuth, citizenRequestController.create);
citizenRequestRouter.get("/", authenticate, citizenRequestController.getAll);
citizenRequestRouter.post("/bulk", authenticate, requireStaff, citizenRequestController.bulkUpdate);
citizenRequestRouter.get("/:id", authenticate, citizenRequestController.getOne);
citizenRequestRouter.post("/:id/comments", authenticate, citizenRequestController.addComment);
citizenRequestRouter.patch("/:id", authenticate, requireStaff, citizenRequestController.update);
citizenRequestRouter.delete("/:id", authenticate, requireAdmin, citizenRequestController.delete);

export default citizenRequestRouter;
