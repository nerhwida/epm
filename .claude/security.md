# 보안 코딩 가이드라인

이 프로젝트(Node.js + Express + MongoDB + React)에서 코드를 작성할 때 아래 규칙을 반드시 지킨다.

---

## 1. 인증 / JWT

- JWT는 반드시 `httpOnly: true` 쿠키로 전달한다. `localStorage` / `sessionStorage` 저장 금지.
- `jwt.sign` / `jwt.verify`에 사용하는 시크릿은 `process.env.JWT_SECRET`만 사용한다.
  - **금지**: `const SECRET = process.env.JWT_SECRET || "fallback-value"`
  - **금지**: 코드에 시크릿 리터럴 하드코딩
- 서버 시작 시 `JWT_SECRET` 미설정이면 `process.exit(1)`로 즉시 종료한다.
- 토큰 만료 시간(`expiresIn`)을 반드시 설정한다.
- 로그아웃 시 서버 측 블랙리스트에 토큰을 추가해 즉시 무효화한다.
- 쿠키 옵션 기본값:
  ```js
  { httpOnly: true, sameSite: "strict", maxAge: 8 * 60 * 60 * 1000,
    ...(process.env.NODE_ENV === "production" ? { secure: true } : {}) }
  ```

## 2. 입력 검증

- 모든 외부 입력(req.body, req.query, req.params)에 타입과 길이를 검증한다.
  ```js
  if (typeof username !== "string" || username.length > 50) { ... }
  ```
- MongoDB 쿼리에 사용자 입력을 직접 넣지 않는다. regex 검색 시 반드시 escape한다.
  ```js
  function escapeRegex(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  ```
- 쓰기 가능 필드는 화이트리스트(`pickWritableFields`)로만 허용한다.
- 페이지네이션 `limit`에 상한을 둔다(`Math.min(..., 100)`).

## 3. Rate Limiting

- 인증 엔드포인트(`/api/auth/login`)에는 항상 `express-rate-limit`을 적용한다.
  ```js
  import rateLimit from "express-rate-limit";
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  router.post("/login", loginLimiter, handler);
  ```
- 공개 API(인증 없이 접근 가능한 엔드포인트)에도 적절한 제한을 적용한다.

## 4. CORS

- `cors()` 기본 설정(전체 허용)을 사용하지 않는다.
- `origin`은 환경변수로 명시한다.
  ```js
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  ```
- `credentials: true`를 사용할 때 `origin: "*"` 금지.

## 5. 보안 HTTP 헤더

- `helmet`을 모든 Express 앱에 적용한다.
  ```js
  import helmet from "helmet";
  app.use(helmet()); // 반드시 다른 미들웨어보다 먼저
  ```
- `helmet()`이 기본으로 설정하는 헤더: `X-Frame-Options`, `X-Content-Type-Options`,
  `Strict-Transport-Security`, `Content-Security-Policy` 등.

## 6. 환경변수 / 시크릿 관리

- 비밀번호, API 키, JWT 시크릿을 코드에 하드코딩하지 않는다.
- 기본값(fallback)으로 예측 가능한 값을 사용하지 않는다.
- 필수 환경변수 목록을 서버 시작 시 검사하고, 누락 시 종료한다.
  ```js
  for (const key of ["JWT_SECRET", "MONGODB_URI"]) {
    if (!process.env[key]) { console.error(`[오류] ${key} 미설정`); process.exit(1); }
  }
  ```
- `.env` 파일을 `.gitignore`에 포함하고, `.env.example`에 키 이름만 남긴다.
- 기본 계정 비밀번호는 환경변수(`DEFAULT_ADMIN_PASSWORD` 등)로 주입한다.

## 7. 에러 처리 / 로깅

- `500` 에러 핸들러에서 스택 트레이스를 클라이언트에 노출하지 않는다.
  ```js
  app.use((err, req, res, next) => {
    if (process.env.NODE_ENV !== "production") console.error(err);
    else console.error(`[${new Date().toISOString()}] ${err.message}`);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  });
  ```
- 인증 실패 응답에 구체적인 실패 이유(아이디 없음 vs 비밀번호 틀림)를 구분하지 않는다.

## 8. XSS

- React에서 `dangerouslySetInnerHTML`을 사용하지 않는다.
- 서버에서 HTML을 직접 렌더링할 경우 반드시 escape한다.
- `helmet`의 CSP 헤더가 추가 방어선 역할을 한다.

## 9. NoSQL Injection

- Mongoose 모델을 통한 쿼리는 기본적으로 안전하다.
- `$where`, `eval`, 사용자 입력을 직접 MongoDB 연산자 키(`$gt`, `$in` 등)로 사용하는 패턴을 피한다.
  ```js
  // 금지
  Model.find({ age: req.body.age }); // { age: { $gt: 0 } } 주입 가능
  // 허용
  Model.find({ age: Number(req.body.age) });
  ```

## 10. 권한 검사

- 모든 변경 API(POST/PUT/DELETE)에 인증 미들웨어를 적용한다.
- `requireAuth` (로그인 확인)와 `requireAdmin` (관리자 확인)을 구분해서 사용한다.
- 미들웨어를 라우터 단위가 아닌 개별 핸들러에만 적용하는 실수를 하지 않는다.
  ```js
  // 올바른 방법: 라우터 마운트 시 적용
  app.use("/api/appointments", requireAuth, appointmentsRouter);
  ```

## 11. JWT 알고리즘 고정

- `jwt.verify` 호출 시 반드시 허용 알고리즘을 명시한다.
  명시하지 않으면 공격자가 `alg: none`으로 서명을 우회할 수 있다.
  ```js
  // 금지
  jwt.verify(token, secret);
  // 허용
  jwt.verify(token, secret, { algorithms: ["HS256"] });
  ```
- `jwt.sign`도 알고리즘을 명시한다: `{ algorithm: "HS256" }`.

## 12. 타이밍 공격 방지 (사용자 열거)

- 로그인 시 사용자가 존재하지 않더라도 항상 `bcrypt.compare`를 실행한다.
  사용자 미존재 시 bcrypt를 건너뛰면 응답 속도 차이로 아이디 존재 여부가 노출된다.
  ```js
  const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu";
  const user = await User.findOne({ username }).select("+password");
  const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);
  if (!user || !valid) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }
  ```

## 13. 민감 필드 DB 기본 제외

- Mongoose 스키마에서 `password` 같은 민감 필드는 `select: false`로 기본 제외한다.
  쿼리 결과에 실수로 포함되는 것을 방지한다.
  ```js
  password: { type: String, required: true, select: false }
  ```
- 로그인 등 비밀번호가 필요한 쿼리에서만 명시적으로 포함한다.
  ```js
  const user = await User.findOne({ username }).select("+password");
  ```

## 14. 비밀번호 정책

- 신규 계정 생성 및 비밀번호 변경 시 최소 요구사항을 강제한다.
  ```js
  if (password.length < 8) {
    return res.status(400).json({ error: "비밀번호는 8자 이상이어야 합니다." });
  }
  ```
- 권장 정책: 8자 이상, 숫자·영문 혼합. bcrypt 해시 처리 전에 검증한다.
- bcrypt의 최대 입력 길이(72바이트)를 초과하는 비밀번호는 초과 부분이 무시되므로
  서버에서 최대 길이(예: 100자)도 함께 제한한다.

## 15. Prototype Pollution 방지

- `req.body`의 `__proto__`, `constructor`, `prototype` 키가 내부 객체에 전파되지 않도록 한다.
- 화이트리스트 기반 `pickWritableFields`가 기본 방어선이지만,
  `Object.assign`이나 스프레드(`...`)로 body를 직접 병합하지 않는다.
  ```js
  // 금지
  Object.assign(target, req.body);
  const data = { ...req.body };
  // 허용
  const data = pickWritableFields(req.body);
  ```
- 필요 시 입력 단계에서 위험 키를 제거한다.
  ```js
  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  function sanitize(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !DANGEROUS_KEYS.has(k)));
  }
  ```

## 16. 보안 이벤트 감사 로그

- 다음 이벤트는 반드시 서버 로그에 기록한다 (IP, 사용자명, 타임스탬프 포함).
  - 로그인 성공 / 실패
  - 로그아웃
  - 관리자 데이터 생성·수정·삭제
  - 권한 없는 접근 시도 (403)
  ```js
  function auditLog(event, { username, ip, detail } = {}) {
    console.log(JSON.stringify({
      time: new Date().toISOString(),
      event,
      username: username || "anonymous",
      ip: ip || "-",
      detail,
    }));
  }
  // 사용 예
  auditLog("LOGIN_SUCCESS", { username: user.username, ip: req.ip });
  auditLog("LOGIN_FAIL", { username, ip: req.ip });
  auditLog("ADMIN_DELETE", { username: req.user.username, ip: req.ip, detail: id });
  ```
- 로그에 비밀번호, 토큰 값 등 민감 데이터를 포함하지 않는다.

## 17. 의존성 취약점 정기 점검

- 패키지 추가·수정 후 반드시 `npm audit`를 실행한다.
- CI/CD가 없더라도 배포 전 점검을 수동으로 수행한다.
  ```bash
  npm audit              # 취약점 목록 확인
  npm audit fix          # 자동 수정 가능한 항목 적용
  ```
- `package-lock.json`을 버전 관리에 포함해 의존성 버전을 고정한다.
- 직접 사용하지 않는 패키지는 삭제한다 (`npm uninstall`).

## 18. Content-Type 요청 검증

- JSON API 엔드포인트(POST/PUT)에 `Content-Type: application/json` 요청만 허용한다.
  다른 형식의 요청이 의도치 않게 파싱되는 것을 방지한다.
  ```js
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const ct = req.headers["content-type"] || "";
      if (!ct.includes("application/json")) {
        return res.status(415).json({ error: "Content-Type은 application/json이어야 합니다." });
      }
    }
    next();
  });
  ```
