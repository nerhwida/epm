import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { tokenBlacklist, requireAuth, requireAdmin } from "../middleware/auth.js";
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

// 관리자 전용: 유저 목록 조회
authRouter.get("/users", requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find({}, { username: 1, role: 1, created_at: 1 }).lean();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// 관리자 전용: 특정 유저 비밀번호 변경 (현재 비밀번호 확인 없음)
authRouter.put("/users/:username/password", requireAdmin, async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 100) {
      return res.status(400).json({ error: "비밀번호는 8자 이상 100자 이하여야 합니다." });
    }
    const target = req.params.username;
    const user = await User.findOne({ username: target });
    if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    auditLog("PASSWORD_RESET_BY_ADMIN", { username: req.user.username, ip: req.ip, detail: target });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.put("/password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ error: "입력값이 올바르지 않습니다." });
    }
    if (newPassword.length < 8 || newPassword.length > 100) {
      return res.status(400).json({ error: "새 비밀번호는 8자 이상 100자 이하여야 합니다." });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      auditLog("PASSWORD_CHANGE_FAIL", { username: req.user.username, ip: req.ip });
      return res.status(401).json({ error: "현재 비밀번호가 올바르지 않습니다." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // 비밀번호 변경 후 현재 토큰 무효화 → 재로그인 강제
    const token = req.cookies?.epm_token;
    if (token) tokenBlacklist.add(token);
    res.clearCookie("epm_token");

    auditLog("PASSWORD_CHANGE", { username: req.user.username, ip: req.ip });
    res.json({ ok: true, message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요." });
  } catch (error) {
    next(error);
  }
});
