import { Router } from "express";
import { ProgressionService } from "../services/progression_service";

export const cleanerGamificationRouter = Router();
const progression = new ProgressionService();

cleanerGamificationRouter.get("/cleaners/:id/progression", async (req, res) => {
  try {
    const cleaner_id = req.params.id;
    const current_level = Number(req.query.current_level ?? 1); // TODO: load from DB
    const data = await progression.getCleanerProgression(cleaner_id, current_level);
    res.json({ ok: true, ...data });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message ?? String(e) });
  }
});
