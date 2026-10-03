import express from "express";
import terraNovaController from "../controller/terraNova.controller";
import { authenticate, requireStaff } from "../middleware/auth";
const terraNovaRouter = express.Router();

terraNovaRouter.use(authenticate, requireStaff);
terraNovaRouter.get("/requests", terraNovaController.feed);

export default terraNovaRouter;
