import express from "express";
import meController from "../controller/me.controller";
import { authenticate } from "../middleware/auth";
const meRouter = express.Router();

meRouter.use(authenticate);
meRouter.get("/", meController.get);
meRouter.patch("/", meController.update);
meRouter.delete("/", meController.deleteAccount);
meRouter.patch("/password", meController.changePassword);
meRouter.post("/onboarding/complete", meController.completeOnboarding);

export default meRouter;
