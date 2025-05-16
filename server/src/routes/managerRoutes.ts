import express from "express";
import {
  getManager,
  createManager,
  updateManager,
} from "../controllers/managerControllers";

const router = express.Router();

router.get("/:cognitoId", getManager);
router.get("/:cognitoId", updateManager);
router.post("/", createManager);

export default router;