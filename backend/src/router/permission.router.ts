import express from "express";
import permissionController from "../controller/permission.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const permissionRouter = express.Router();

// D08 / D09: effective roles matrix (defaults + admin overrides)
permissionRouter.get("/", authenticate, requirePermission("permissions.read"), permissionController.list);
permissionRouter.patch("/:key", authenticate, requirePermission("permissions.manage"), permissionController.update);

export default permissionRouter;
