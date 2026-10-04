import express from "express";
import terraNovaController from "../controller/terraNova.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const terraNovaRouter = express.Router();

terraNovaRouter.use(authenticate, requirePermission("dashboard.read"));
terraNovaRouter.get("/requests", terraNovaController.feed);

export default terraNovaRouter;
