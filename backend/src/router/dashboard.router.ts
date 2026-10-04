import express from "express";
import dashboardController from "../controller/dashboard.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const dashboardRouter = express.Router();

dashboardRouter.use(authenticate, requirePermission("dashboard.read"));
dashboardRouter.get("/stats", dashboardController.stats);
dashboardRouter.get("/trends", dashboardController.trends);
dashboardRouter.get("/summary", dashboardController.summary);

export default dashboardRouter;
