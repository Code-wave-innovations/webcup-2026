import express from "express";
import translationController from "../controller/translation.controller";
import { authenticate, requireAdmin } from "../middleware/auth";
const translationRouter = express.Router();

translationRouter.use(authenticate, requireAdmin);
translationRouter.get("/schema", translationController.schema);
translationRouter.get("/", translationController.getAll);
translationRouter.put("/", translationController.upsert);
translationRouter.delete("/:id", translationController.delete);

export default translationRouter;
