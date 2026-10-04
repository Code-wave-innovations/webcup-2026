import express from "express";
import securityController from "../controller/security.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const securityRouter = express.Router();

securityRouter.use(authenticate);
// F100: agents read the event feed (no IP). The overview stays on security.read (admin).
securityRouter.get("/events", requirePermission("security.events"), securityController.events);
securityRouter.use(requirePermission("security.read"));
securityRouter.get("/overview", securityController.overview);
securityRouter.get("/login-attempts", securityController.attempts);
securityRouter.get("/client-ip", securityController.clientIp);
securityRouter.get("/new-devices", securityController.newDevices);

export default securityRouter;
