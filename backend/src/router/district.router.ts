import express from "express";
import districtController from "../controller/district.controller";
import { authenticate, optionalAuth, requireAdmin } from "../middleware/auth";
const districtRouter = express.Router();

districtRouter.get("/", optionalAuth, districtController.getAll);
districtRouter.get("/:id", optionalAuth, districtController.getOne);
districtRouter.post("/", authenticate, requireAdmin, districtController.create);
districtRouter.patch("/:id", authenticate, requireAdmin, districtController.update);
districtRouter.delete("/:id", authenticate, requireAdmin, districtController.delete);

export default districtRouter;
