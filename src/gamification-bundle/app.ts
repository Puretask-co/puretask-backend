import express from "express";
import bodyParser from "body-parser";
import { cleanerGamificationRouter } from "./routes/cleaners_gamification";
import { adminGamificationRouter } from "./routes/admin_gamification";

const app = express();
app.use(bodyParser.json());
app.use(cleanerGamificationRouter);
app.use(adminGamificationRouter);

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`Gamification API listening on ${port}`));
