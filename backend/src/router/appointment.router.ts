import express from "express";
import appointmentController from "../controller/appointment.controller";
import { authenticate, optionalAuth, requireAdmin, requireStaff } from "../middleware/auth";
const appointmentRouter = express.Router();

const staff = [authenticate, requireStaff];

// Slots (declared before /:id)
appointmentRouter.get("/slots", optionalAuth, appointmentController.getSlots);
appointmentRouter.post("/slots", ...staff, appointmentController.createSlot);
appointmentRouter.post("/slots/bulk", ...staff, appointmentController.createSlotsBulk);
appointmentRouter.patch("/slots/:id", ...staff, appointmentController.updateSlot);
appointmentRouter.delete("/slots/:id", ...staff, appointmentController.deleteSlot);
appointmentRouter.post("/reminders/run", authenticate, requireAdmin, appointmentController.runReminders);

// Appointments
appointmentRouter.post("/", authenticate, appointmentController.book);
appointmentRouter.get("/", authenticate, appointmentController.getAll);
appointmentRouter.get("/:id", authenticate, appointmentController.getOne);
appointmentRouter.get("/:id/ics", authenticate, appointmentController.ics);
appointmentRouter.post("/:id/cancel", authenticate, appointmentController.cancel);
appointmentRouter.patch("/:id/reminder", authenticate, appointmentController.updateReminder);
appointmentRouter.patch("/:id", ...staff, appointmentController.update);

export default appointmentRouter;
