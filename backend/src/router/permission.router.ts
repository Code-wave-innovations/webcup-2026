import express from "express";
import type { Request, Response } from "express";
import { PERMISSIONS } from "../lib/permissions";
import { authenticate, requireStaff } from "../middleware/auth";
const permissionRouter = express.Router();

// D08 / D09: the roles matrix, read-only (the guards themselves live in the routers)
const list = (_req: Request, res: Response) => {
  res.json(PERMISSIONS);
};

permissionRouter.use(authenticate, requireStaff);
permissionRouter.get("/", list);

export default permissionRouter;
