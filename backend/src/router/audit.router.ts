import express from "express";
import auditController from "../controller/audit.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

// F47 / F48. Registered paths are read-only: no PATCH, PUT or DELETE.
const auditRouter = express.Router();

auditRouter.use(authenticate, requireStaff);
auditRouter.get("/export.csv", requireAdmin, auditController.exportCsv);
auditRouter.get("/stats", requireAdmin, auditController.stats);
auditRouter.get("/", auditController.list);

export default auditRouter;
