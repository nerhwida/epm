# 교육청 인사 발령 관리 시스템 (EPM)

비정형 인사 발령 텍스트를 정형 데이터로 변환하고 저장·조회·수정하는 웹 기반 CRUD 시스템입니다.

## 기술 스택

- **Frontend**: React 18 + Vite 8 (포트 5173)
- **Backend**: Node.js + Express (포트 4000)
- **Database**: MongoDB + Mongoose
- **Parser**: 규칙 기반 JavaScript 모듈 (AI/LLM 없음)
- **인증**: JWT (jsonwebtoken) + bcryptjs, httpOnly 쿠키
- **보안**: helmet, express-rate-limit, cookie-parser

## 주요 기능

- 로그인 기반 접근 제어 (관리자 / 일반 사용자)
- 비정형 인사 발령 텍스트 붙여넣기 → 자동 파싱 (관리자 전용)
- 자유형식 / 발령 표(1행·2행) / 퇴직 표 등 다양한 입력 형식 지원
- 파싱 결과 미리보기 테이블에서 셀 직접 수정 (관리자 전용)
- 검수 후 일괄 저장 (관리자 전용)
- 저장 데이터 목록 조회 및 검색 (모든 사용자)
- 이름 / 기관 / 과목 / 현임기관 / 발령일 부분 일치 검색
- 인라인 수정·삭제 (관리자 전용)
- 페이지네이션 및 컬럼 정렬

## 설치

```bash
npm install
```

`.env` 파일을 생성합니다.

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/epm

# 필수: 긴 랜덤 문자열 (미설정 시 서버 시작 거부)
# 생성 예: openssl rand -hex 32
JWT_SECRET=

# 프론트엔드 도메인 (개발 기본값: http://127.0.0.1:5173)
CORS_ORIGIN=http://127.0.0.1:5173

# 선택: 최초 실행 시 기본 계정 비밀번호 (미설정 시 아래 기본값 사용)
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_USER_PASSWORD=user123
```

> `JWT_SECRET`은 **필수** 환경변수입니다. 설정하지 않으면 서버가 시작되지 않습니다.

## 실행

MongoDB를 먼저 실행한 뒤 앱을 시작합니다.

```bash
npm run dev
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://127.0.0.1:5173 |
| API 서버 | http://127.0.0.1:4000 |

## 기본 계정

최초 실행 시 아래 계정이 자동으로 생성됩니다. 운영 환경 사용 전에 반드시 비밀번호를 변경하세요.

| 아이디 | 기본 비밀번호 | 권한 |
|--------|--------------|------|
| admin | admin123 | 관리자 |
| user | user123 | 일반 사용자 |

비밀번호는 최소 8자이며, `.env`의 `DEFAULT_ADMIN_PASSWORD` / `DEFAULT_USER_PASSWORD`로 변경할 수 있습니다.

## 권한별 기능

| 기능 | 관리자 | 일반 사용자 |
|------|--------|-------------|
| 로그인 | ✓ | ✓ |
| 데이터 조회·검색 | ✓ | ✓ |
| 텍스트 파싱 | ✓ | — |
| 데이터 저장·수정·삭제 | ✓ | — |

## 보안 특징

- **JWT를 httpOnly 쿠키로 전달** — JavaScript에서 토큰 접근 불가 (XSS 방어)
- **로그인 rate limiting** — 15분 내 10회 초과 시 차단
- **로그아웃 시 서버 측 토큰 즉시 무효화** — 토큰 블랙리스트 관리
- **JWT 알고리즘 고정** (`HS256`) — algorithm confusion 공격 방지
- **타이밍 공격 방지** — 사용자 미존재 시에도 bcrypt 연산 수행
- **보안 이벤트 감사 로그** — 로그인 성공/실패, 관리자 데이터 조작 기록
- **Content-Type 검증** — POST/PUT 요청에 `application/json` 강제
- **helmet** — CSP, X-Frame-Options 등 보안 헤더 자동 적용
- **의존성 취약점 0개** (`npm audit`)

## 지원 입력 형식

### A. 자유형식 (단건)

```
(한국외국어고) 중등학교 교사 홍길동 국어 신규
중등학교 교사에 임함. (두 서) 학교 근무를 명함. 2026. 3. 1.
```

### B. 발령 표 (1행 포맷)

```
발령기관    직위(급)      성명    과목    현직위(급)    현임기관
(한국고)    중등학교교사  홍길동  수학    중등학교교사  (한국중)
```

### C. 발령 표 (2행 포맷 — 겸직/전직)

```
(한국고)    교육연구관
(교육연구관) 홍길동    중등학교교장    (한국고)
```

### D. 퇴직 표

```
직위(급)      성명        현임기관
중등학교교사  홍 길 동    한국고
```

## 데이터 모델

| 필드 | 설명 |
|------|------|
| organization | 발령기관 (신임교) |
| position | 직위(급) |
| name | 성명 |
| subject | 과목 |
| term | 임용기간 |
| prev_position | 현직위(급) |
| prev_org | 현임기관 |
| appointment_date | 발령일자 |
| raw_text | 원문 |
| parse_status | `parsed` / `needs_review` / `manual` |
| parse_confidence | 0~1 (필수 4개 필드 존재 비율) |
| parse_warnings | 누락 필드 목록 |
| memo | 비고 |

## API

인증은 서버가 설정한 **httpOnly 쿠키**(`epm_token`)로 처리됩니다. 클라이언트는 별도 헤더 없이 `credentials: "include"` 옵션만 설정하면 됩니다.

### 인증

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/login` | 누구나 | 로그인 (httpOnly 쿠키 발급) |
| POST | `/api/auth/logout` | 로그인 | 로그아웃 (쿠키 제거 + 서버 무효화) |
| GET | `/api/auth/me` | 로그인 | 현재 사용자 정보 조회 |

### 데이터

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/parse` | 관리자 | 텍스트 파싱 (저장 안 함) |
| GET | `/api/appointments` | 로그인 | 목록 조회 (페이지네이션 + 필터) |
| POST | `/api/appointments` | 관리자 | 단건 생성 |
| POST | `/api/appointments/bulk` | 관리자 | 다건 저장 |
| GET | `/api/appointments/:id` | 로그인 | 단건 조회 |
| PUT | `/api/appointments/:id` | 관리자 | 수정 |
| DELETE | `/api/appointments/:id` | 관리자 | 삭제 |

### 검색 예시

```
GET /api/appointments?name=홍길동
GET /api/appointments?organization=한국중
GET /api/appointments?subject=국어
GET /api/appointments?appointment_date=2026. 3.
GET /api/appointments?page=2&limit=20
```
