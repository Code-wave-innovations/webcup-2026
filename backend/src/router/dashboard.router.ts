import express from "express";
import dashboardController from "../controller/dashboard.controller";
import { authenticate, requireStaff } from "../middleware/auth";
const dashboardRouter = express.Router();

dashboardRouter.use(authenticate, requireStaff);
dashboardRouter.get("/stats", dashboardController.stats);
dashboardRouter.get("/trends", dashboardController.trends);
dashboardRouter.get("/summary", dashboardController.summary);
dashboardRouter.get("/activity", dashboardController.activity);

export default dashboardRouter;
