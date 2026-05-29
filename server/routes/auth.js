import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { tokenBlacklist } from "../middleware/auth.js";
import { auditLog } from "../utils/audit.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." },
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  maxAge: 8 * 60 * 60 * 1000,
  ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
};

// 규칙 12: 사용자 미존재 시에도 bcrypt 실행 시간을 일정하게 유지 (타이밍 공격 방지)
const DUMMY_HASH = bcrypt.hashSync("__timing_guard__", 10);

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요." });
    }
    if (typeof username !== "string" || username.length > 50) {
      return res.status(400).json({ error: "입력값이 올바르지 않습니다." });
    }
    // 규칙 14: 비밀번호 최소 길이 + 최대 길이 (bcrypt 72바이트 한계 대비)
    if (typeof password !== "string" || password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: "입력값이 올바르지 않습니다." });
    }

    // 규칙 13: select:false 필드이므로 +password 명시
    const user = await User.findOne({ username }).select("+password");

    // 규칙 12: 사용자 없어도 bcrypt 실행 → 응답 시간 균일화
    const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user || !valid) {
      auditLog("LOGIN_FAIL", { username, ip: req.ip });
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }

    // 규칙 11: 알고리즘 명시
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "8h" }
    );
    res.cookie("epm_token", token, COOKIE_OPTIONS);
    auditLog("LOGIN_SUCCESS", { username: user.username, ip: req.ip });
    res.json({ username: user.username, role: user.role });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (req, res) => {
  const token = req.cookies?.epm_token;
  let username = "unknown";
  if (token) {
    try {
      // 규칙 11: 알고리즘 명시
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      username = payload.username;
    } catch {}
    tokenBlacklist.add(token);
  }
  res.clearCookie("epm_token");
  auditLog("LOGOUT", { username, ip: req.ip });
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  const token = req.cookies?.epm_token;
  if (!token || tokenBlacklist.has(token)) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }
  try {
    // 규칙 11: 알고리즘 명시
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    res.json({ username: payload.username, role: payload.role });
  } catch {
    res.status(401).json({ error: "토큰이 유효하지 않습니다." });
  }
});
