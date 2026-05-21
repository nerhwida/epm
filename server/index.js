import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDb } from "./db.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { parseRouter } from "./routes/parse.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI || "mongodb+srv://mymongo:<db_password>@cluster0.lvfp5so.mongodb.net/?appName=Cluster0";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/parse", parseRouter);
app.use("/api/appointments", appointmentsRouter);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

connectDb(mongoUri)
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
