import { Router } from "express";
import { parseAppointments } from "../parser.js";

export const parseRouter = Router();

parseRouter.post("/", (req, res) => {
  const text = String(req.body?.text || "");
  if (!text.trim()) {
    return res.status(400).json({ error: "파싱할 텍스트를 입력하세요." });
  }
  return res.json({ items: parseAppointments(text) });
});
