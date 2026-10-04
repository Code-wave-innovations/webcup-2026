import express from "express";
import securityController from "../controller/security.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const securityRouter = express.Router();

securityRouter.use(authenticate, requirePermission("security.read"));
securityRouter.get("/overview", securityController.overview);
securityRouter.get("/login-attempts", securityController.attempts);
securityRouter.get("/client-ip", securityController.clientIp);
securityRouter.get("/new-devices", securityController.newDevices);

export default securityRouter;
