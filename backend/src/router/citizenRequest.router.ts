import express from "express";
import citizenRequestController from "../controller/citizenRequest.controller";
import { authenticate, optionalAuth, requireAdmin, requireStaff } from "../middleware/auth";
const citizenRequestRouter = express.Router();

// optionalAuth: visitors can send a CONTACT request (D04)
citizenRequestRouter.post("/", optionalAuth, citizenRequestController.create);
citizenRequestRouter.get("/", authenticate, citizenRequestController.getAll);
citizenRequestRouter.get("/:id", authenticate, citizenRequestController.getOne);
citizenRequestRouter.post("/:id/comments", authenticate, citizenRequestController.addComment);
citizenRequestRouter.patch("/:id", authenticate, requireStaff, citizenRequestController.update);
citizenRequestRouter.delete("/:id", authenticate, requireAdmin, citizenRequestController.delete);

export default citizenRequestRouter;
