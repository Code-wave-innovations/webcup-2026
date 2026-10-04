import express from "express";
import appointmentController from "../controller/appointment.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const appointmentRouter = express.Router();

const manage = [authenticate, requirePermission("appointments.manage")];

appointmentRouter.get("/slots", optionalAuth, appointmentController.getSlots);
appointmentRouter.post("/slots", ...manage, appointmentController.createSlot);
appointmentRouter.post("/slots/bulk", ...manage, appointmentController.createSlotsBulk);
appointmentRouter.patch("/slots/:id", ...manage, appointmentController.updateSlot);
appointmentRouter.delete("/slots/:id", ...manage, appointmentController.deleteSlot);
appointmentRouter.post("/reminders/run", authenticate, requirePermission("reminders.run"), appointmentController.runReminders);

appointmentRouter.post("/", authenticate, appointmentController.book);
appointmentRouter.get("/", authenticate, appointmentController.getAll);
appointmentRouter.get("/:id", authenticate, appointmentController.getOne);
appointmentRouter.get("/:id/ics", authenticate, appointmentController.ics);
appointmentRouter.post("/:id/cancel", authenticate, appointmentController.cancel);
appointmentRouter.patch("/:id/reminder", authenticate, appointmentController.updateReminder);
appointmentRouter.patch("/:id", ...manage, appointmentController.update);

export default appointmentRouter;
