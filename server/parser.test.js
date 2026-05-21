import assert from "node:assert/strict";
import { parseAppointments } from "./parser.js";

function pickRows(items) {
  return items.map((item) => ({
    organization: item.organization,
    position: item.position,
    name: item.name,
    subject: item.subject,
    term: item.term,
    prev_position: item.prev_position,
    prev_org: item.prev_org,
    appointment_date: item.appointment_date,
  }));
}

function assertParsed(name, text, expected) {
  assert.deepEqual(pickRows(parseAppointments(text)), expected, name);
}

assertParsed(
  "new teacher appointment",
  `나. 중등학교 교사 신규 임용
발령 기관 직위(급) 성명 과목 현임 기관
( 대 전 외 국 어 고 ) 중등학교 교사 이 지 혜 스페인어 신 규
중등학교 교사에 임함. (두 서) 학교 근무를 명함. 2025. 9. 1. 대전광역시교육감`,
  [
    {
      organization: "대전외국어고",
      position: "중등학교 교사",
      name: "이지혜",
      subject: "스페인어",
      term: "",
      prev_position: "",
      prev_org: "신규",
      appointment_date: "2025. 9. 1.",
    },
  ],
);

assertParsed(
  "retirement with current school header",
  `1) 중등교사 정년퇴직
직위(급) 성명 현 임 교
중 등 학 교 교 사 김 기 화 유 성 고
중 등 학 교 교 사 김 선 철 대 전 도 시 과 학 고
교육공무원법 제47조의 규정에 의하여 정년퇴직. 2025. 2. 28.
대전광역시교육감`,
  [
    {
      organization: "정년퇴직",
      position: "중등학교 교사",
      name: "김기화",
      subject: "",
      term: "",
      prev_position: "중등학교 교사",
      prev_org: "유성고",
      appointment_date: "2025. 2. 28.",
    },
    {
      organization: "정년퇴직",
      position: "중등학교 교사",
      name: "김선철",
      subject: "",
      term: "",
      prev_position: "중등학교 교사",
      prev_org: "대전도시과학고",
      appointment_date: "2025. 2. 28.",
    },
  ],
);

assertParsed(
  "transfer with region markers",
  `신 임 교 직위(급) 성명 과목 현 임 교
( 충 남 기 계 공 고 ) 중등학교 교사 김 가 람 기계·금속 (서울) 경기기계공업고
(대전광역시교육청) 전문상담교사 김 하 제 전문상담 ( 세 종 ) 다 정 초
( 대 전 신 계 중 ) 중 등 학 교 교 사 류 새 별 기술･가정 대 전 문 정 중
(두 서) 학교(기관) 근무를 명함.
2025. 3. 1.`,
  [
    {
      organization: "충남기계공고",
      position: "중등학교 교사",
      name: "김가람",
      subject: "기계·금속",
      term: "",
      prev_position: "중등학교 교사",
      prev_org: "(서울)경기기계공업고",
      appointment_date: "2025. 3. 1.",
    },
    {
      organization: "대전광역시교육청",
      position: "전문상담교사",
      name: "김하제",
      subject: "전문상담",
      term: "",
      prev_position: "전문상담교사",
      prev_org: "(세종)다정초",
      appointment_date: "2025. 3. 1.",
    },
    {
      organization: "대전신계중",
      position: "중등학교 교사",
      name: "류새별",
      subject: "기술·가정",
      term: "",
      prev_position: "중등학교 교사",
      prev_org: "대전문정중",
      appointment_date: "2025. 3. 1.",
    },
  ],
);

assertParsed(
  "principal appointment terms",
  `2. 중등학교장
가. 중등학교장 승진(교감 ․ 공모교장 → 교장)
발 령 기 관 직위(급) 성 명 임용 기간 현직위(급) 현 임 기 관
( 회 덕 중 ) 중등학교장 김충식 2025.9.1.~2029.8.31. 중등학교 교감 대 전 문 지 중
( 대 전 둔 원 고 ) 중등학교장 윤장순 2025.9.1.~2027.2.28. 중등학교장 대 전 고
중등학교장에 임함. 대전광역시교육감이 지정하는 학교 근무를 명함. 2025. 9. 1.
대 통 령
(두 서) 학교 근무를 명함. 2025. 9. 1.`,
  [
    {
      organization: "회덕중",
      position: "중등학교 교장",
      name: "김충식",
      subject: "",
      term: "2025.9.1.~2029.8.31.",
      prev_position: "중등학교 교감",
      prev_org: "대전문지중",
      appointment_date: "2025. 9. 1.",
    },
    {
      organization: "대전둔원고",
      position: "중등학교 교장",
      name: "윤장순",
      subject: "",
      term: "2025.9.1.~2027.2.28.",
      prev_position: "중등학교 교장",
      prev_org: "대전고",
      appointment_date: "2025. 9. 1.",
    },
  ],
);

console.log("parser tests passed");
