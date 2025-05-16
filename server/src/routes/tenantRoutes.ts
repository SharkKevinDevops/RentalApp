import express from "express";
import { deflate } from "zlib";
import {
    getTenant,
    createTenant,
    updateTenant
} from "../controllers/tenantController";

const router = express.Router();

router.get("/:cognitoId", getTenant);
router.get("/:cognitoId", updateTenant);
router.post("/", createTenant);



export default router;// Importing the authMiddleware to protect routes