import express from "express";
import translationController from "../controller/translation.controller";
import { authenticate, requirePermission } from "../middleware/auth";

const translationRouter = express.Router();

translationRouter.use(authenticate, requirePermission("translations.manage"));
translationRouter.get("/schema", translationController.schema);
translationRouter.get("/", translationController.getAll);
translationRouter.put("/", translationController.upsert);
translationRouter.delete("/:id", translationController.delete);

export default translationRouter;
