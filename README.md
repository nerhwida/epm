# 교육청 인사 발령 관리 시스템

한글/PDF 문서에서 복사한 비정형 인사 발령 텍스트를 규칙 기반으로 파싱하고, 검수 후 MongoDB에 저장하는 웹 애플리케이션입니다.

## 주요 기능

- 원문 텍스트 붙여넣기
- 규칙 기반 파싱
- 파싱 결과 미리보기 및 직접 수정
- 일괄 저장
- 목록 조회
- 이름, 기관, 과목, 발령일 부분 일치 검색
- 페이지네이션
- 삭제

## 기술 스택

- Backend: Node.js, Express
- Database: MongoDB, Mongoose
- Frontend: React, Vite
- Parser: 로컬 규칙 기반 JavaScript 모듈

## 설치

```bash
npm install
```

`.env` 파일을 만듭니다.

```bash
cp .env.example .env
```

MongoDB 주소를 환경에 맞게 수정합니다.

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/epm
```

## 실행

MongoDB를 먼저 실행한 뒤 앱을 시작합니다.

```bash
npm run dev
```

접속 주소:

```text
http://127.0.0.1:5173
```

API 서버:

```text
http://127.0.0.1:4000
```

## 데이터 필드

| 필드 | 설명 |
| --- | --- |
| organization | 발령기관 |
| position | 직위 |
| name | 성명 |
| subject | 과목 |
| term | 임용기간 |
| prev_position | 현직위 |
| prev_org | 현임기관 |
| appointment_date | 발령일자 |
| raw_text | 원문 |
| parse_status | 파싱 상태 |
| parse_confidence | 파싱 신뢰도 |
| parse_warnings | 파싱 경고 |
| memo | 메모 |

`신규`는 요구사항에 따라 `prev_org`에 저장합니다.

## API

```text
POST   /api/parse
POST   /api/appointments
POST   /api/appointments/bulk
GET    /api/appointments
GET    /api/appointments/:id
PUT    /api/appointments/:id
DELETE /api/appointments/:id
```

검색 예:

```text
GET /api/appointments?name=지혜
GET /api/appointments?organization=외국어
GET /api/appointments?subject=스페인
GET /api/appointments?appointment_date=2025. 9.
```

## 파싱 방식

현재 파서는 다음 규칙을 우선 사용합니다.

- 날짜 패턴 `YYYY. M. D.`를 기준으로 레코드를 분리
- 첫 번째 괄호 안 텍스트를 발령기관 후보로 사용
- 직위 키워드 목록에서 직위 추출
- 직위 뒤 2~4글자 한글 이름 후보 추출
- 이름 뒤 과목 키워드 목록에서 과목 추출
- `신규` 포함 시 `prev_org`에 `신규` 저장
- 찾지 못한 필드는 빈 문자열로 유지

파싱 결과는 바로 저장하지 않고 미리보기 테이블에서 수정한 뒤 저장하는 흐름입니다.

## 향후 개선

- 수정 화면 추가
- 엑셀 업로드/내보내기
- 과목/직위 사전 관리 화면
- 파싱 규칙 테스트 케이스 추가
- AI 기반 파싱 보정 기능
