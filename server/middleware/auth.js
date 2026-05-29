import jwt from "jsonwebtoken";

// 로그아웃된 토큰 목록 (서버 재시작 시 초기화 — 짧은 만료 시간으로 보완)
export const tokenBlacklist = new Set();

export function requireAuth(req, res, next) {
  const token = req.cookies?.epm_token;
  if (!token || tokenBlacklist.has(token)) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }
  try {
    // 규칙 11: 알고리즘 명시 — algorithm confusion 공격 방지
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    next();
  } catch {
    res.status(401).json({ error: "토큰이 유효하지 않습니다. 다시 로그인해 주세요." });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    next();
  });
}
