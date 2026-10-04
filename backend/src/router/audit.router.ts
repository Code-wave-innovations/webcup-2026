import express from "express";
import auditController from "../controller/audit.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const auditRouter = express.Router();

auditRouter.get("/", authenticate, requirePermission("audit.read"), auditController.list);
auditRouter.get("/export.csv", authenticate, requirePermission("audit.export"), auditController.exportCsv);
auditRouter.get("/stats", authenticate, requirePermission("audit.export"), auditController.stats);

export default auditRouter;
