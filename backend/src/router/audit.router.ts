import express from "express";
import auditController from "../controller/audit.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";
const auditRouter = express.Router();

// F47: read-only on purpose, no PATCH or DELETE
auditRouter.use(authenticate, requireStaff);
auditRouter.get("/", auditController.list);
auditRouter.get("/export.csv", requireAdmin, auditController.exportCsv);
auditRouter.get("/stats", requireAdmin, auditController.stats);

export default auditRouter;
