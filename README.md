# 교육청 인사 발령 관리 시스템 (EPM)

비정형 인사 발령 텍스트를 정형 데이터로 변환하고 저장·조회·수정하는 웹 기반 CRUD 시스템입니다.

## 기술 스택

- **Frontend**: React 18 + Vite (포트 5173)
- **Backend**: Node.js + Express (포트 4000)
- **Database**: MongoDB + Mongoose
- **Parser**: 규칙 기반 JavaScript 모듈 (AI/LLM 없음)

## 주요 기능

- 비정형 인사 발령 텍스트 붙여넣기 → 자동 파싱
- 자유형식 / 발령 표(1행·2행) / 퇴직 표 등 다양한 입력 형식 지원
- 파싱 결과 미리보기 테이블에서 셀 직접 수정
- 검수 후 일괄 저장
- 저장 데이터 목록 조회, 인라인 수정·삭제
- 이름 / 기관 / 과목 / 현임기관 / 발령일 부분 일치 검색
- 페이지네이션

## 설치

```bash
npm install
```

`.env` 파일을 생성합니다.

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/epm
```

## 실행

MongoDB를 먼저 실행한 뒤 앱을 시작합니다.

```bash
npm run dev
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://127.0.0.1:5173 |
| API 서버 | http://127.0.0.1:4000 |

## 지원 입력 형식

### A. 자유형식 (단건)

```
(대전외국어고) 중등학교 교사 이지혜 스페인어 신규
중등학교 교사에 임함. (두 서) 학교 근무를 명함. 2025. 9. 1.
```

### B. 발령 표 (1행 포맷)

```
발령기관    직위(급)      성명    과목    현직위(급)    현임기관
(대전고)    중등학교교사  홍길동  수학    중등학교교사  (대전중)
```

### C. 발령 표 (2행 포맷 — 겸직/전직)

```
(대전고)    교육연구관
(교육연구관) 홍길동    중등학교교장    (대전고)
```

### D. 퇴직 표

```
직위(급)      성명        현임기관
중등학교교사  홍 길 동    대전고
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

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/parse` | 텍스트 파싱 (저장 안 함) |
| GET | `/api/appointments` | 목록 조회 (페이지네이션 + 필터) |
| POST | `/api/appointments` | 단건 생성 |
| POST | `/api/appointments/bulk` | 다건 저장 |
| GET | `/api/appointments/:id` | 단건 조회 |
| PUT | `/api/appointments/:id` | 수정 |
| DELETE | `/api/appointments/:id` | 삭제 |

### 검색 예시

```
GET /api/appointments?name=지혜
GET /api/appointments?organization=외국어
GET /api/appointments?subject=스페인
GET /api/appointments?appointment_date=2025. 9.
GET /api/appointments?page=2&limit=20
```
