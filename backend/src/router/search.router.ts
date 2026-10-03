import express from "express";
import searchController from "../controller/search.controller";
import { optionalAuth } from "../middleware/auth";
const searchRouter = express.Router();

searchRouter.get("/", optionalAuth, searchController.search);

export default searchRouter;
