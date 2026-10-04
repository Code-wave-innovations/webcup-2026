import express from "express";
import transitController from "../controller/transit.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const transitRouter = express.Router();

const manage = [authenticate, requirePermission("transit.manage")];

transitRouter.get("/lines", optionalAuth, transitController.getLines);
transitRouter.get("/lines/:idOrCode", optionalAuth, transitController.getLine);
transitRouter.get("/disruptions", optionalAuth, transitController.getDisruptions);
transitRouter.get("/stops", optionalAuth, transitController.getStops);
transitRouter.get("/stops/:id", optionalAuth, transitController.getStop);

transitRouter.post("/lines", ...manage, transitController.createLine);
transitRouter.patch("/lines/:id", ...manage, transitController.updateLine);
transitRouter.patch("/lines/:id/status", ...manage, transitController.updateStatus);
transitRouter.put("/lines/:id/stops", ...manage, transitController.setLineStops);
transitRouter.put("/lines/:id/timetable", ...manage, transitController.setTimetable);
transitRouter.delete("/lines/:id", ...manage, transitController.deleteLine);
transitRouter.post("/stops", ...manage, transitController.createStop);
transitRouter.patch("/stops/:id", ...manage, transitController.updateStop);
transitRouter.delete("/stops/:id", ...manage, transitController.deleteStop);

export default transitRouter;
