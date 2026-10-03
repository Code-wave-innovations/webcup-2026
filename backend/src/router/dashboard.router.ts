import express from "express";
import dashboardController from "../controller/dashboard.controller";
import { authenticate, requireStaff } from "../middleware/auth";
const dashboardRouter = express.Router();

dashboardRouter.use(authenticate, requireStaff);
dashboardRouter.get("/stats", dashboardController.stats);

export default dashboardRouter;
