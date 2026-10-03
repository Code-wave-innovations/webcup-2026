import express from "express";
import transitController from "../controller/transit.controller";
import { authenticate, optionalAuth, requireStaff } from "../middleware/auth";
const transitRouter = express.Router();

const staff = [authenticate, requireStaff];

transitRouter.get("/lines", optionalAuth, transitController.getLines);
transitRouter.get("/lines/:idOrCode", optionalAuth, transitController.getLine);
transitRouter.get("/disruptions", optionalAuth, transitController.getDisruptions);
transitRouter.get("/stops", optionalAuth, transitController.getStops);
transitRouter.get("/stops/:id", optionalAuth, transitController.getStop);

transitRouter.post("/lines", ...staff, transitController.createLine);
transitRouter.patch("/lines/:id", ...staff, transitController.updateLine);
transitRouter.patch("/lines/:id/status", ...staff, transitController.updateStatus);
transitRouter.put("/lines/:id/stops", ...staff, transitController.setLineStops);
transitRouter.put("/lines/:id/timetable", ...staff, transitController.setTimetable);
transitRouter.delete("/lines/:id", ...staff, transitController.deleteLine);
transitRouter.post("/stops", ...staff, transitController.createStop);
transitRouter.patch("/stops/:id", ...staff, transitController.updateStop);
transitRouter.delete("/stops/:id", ...staff, transitController.deleteStop);

export default transitRouter;
