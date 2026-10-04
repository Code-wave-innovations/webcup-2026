import express from "express";
import districtController from "../controller/district.controller";
import { authenticate, optionalAuth, requirePermission } from "../middleware/auth";

const districtRouter = express.Router();

districtRouter.get("/", optionalAuth, districtController.getAll);
districtRouter.get("/:id", optionalAuth, districtController.getOne);
districtRouter.post("/", authenticate, requirePermission("catalog.manage"), districtController.create);
districtRouter.patch("/:id", authenticate, requirePermission("catalog.manage"), districtController.update);
districtRouter.delete("/:id", authenticate, requirePermission("catalog.manage"), districtController.delete);

export default districtRouter;
