import express from "express";
import homeController from "../controller/home.controller";
import { optionalAuth } from "../middleware/auth";
const homeRouter = express.Router();

homeRouter.get("/", optionalAuth, homeController.get);

export default homeRouter;
