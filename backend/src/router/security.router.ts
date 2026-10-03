import express from "express";
import securityController from "../controller/security.controller";
import { authenticate, requireAdmin } from "../middleware/auth";
const securityRouter = express.Router();

securityRouter.use(authenticate, requireAdmin);
securityRouter.get("/overview", securityController.overview);
securityRouter.get("/login-attempts", securityController.attempts);
securityRouter.get("/client-ip", securityController.clientIp);

export default securityRouter;
