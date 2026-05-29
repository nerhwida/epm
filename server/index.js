import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { connectDb, ensureDefaultUsers } from "./db.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { parseRouter } from "./routes/parse.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";

if (!process.env.JWT_SECRET) {
  console.error("[보안 오류] JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일에 JWT_SECRET을 추가하세요.");
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("[오류] MONGODB_URI 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://127.0.0.1:5173",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// 규칙 18: JSON API에 application/json 외 Content-Type 차단
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = req.headers["content-type"] || "";
    if (!ct.includes("application/json")) {
      return res.status(415).json({ error: "Content-Type은 application/json이어야 합니다." });
    }
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);

app.use("/api/parse", requireAdmin, parseRouter);

app.use("/api/appointments", (req, res, next) => {
  if (req.method === "GET") return requireAuth(req, res, next);
  return requireAdmin(req, res, next);
}, appointmentsRouter);

// 프로덕션: 빌드된 프론트엔드 서빙 + SPA 폴백
if (process.env.NODE_ENV === "production") {
  const distPath = join(dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(join(distPath, "index.html")));
}

app.use((error, req, res, next) => {
  if (process.env.NODE_ENV !== "production") console.error(error);
  else console.error(`[${new Date().toISOString()}] ${error.message}`);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

connectDb(mongoUri)
  .then(async () => {
    await ensureDefaultUsers();
    app.listen(port, () => {
      console.log(`Server running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
