const DATE_RE = /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./g;
const DATE_TEST_RE = /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./;

const POSITION_KEYWORDS = [
  "중등학교 수석교사",
  "초등학교 수석교사",
  "중등학교 교장",
  "중등학교 교감",
  "중등학교 교사",
  "초등학교 교장",
  "초등학교 교감",
  "초등학교 교사",
  "유치원 원장",
  "유치원 원감",
  "유치원 교사",
  "특수학교 교장",
  "특수학교 교감",
  "특수학교 수석교사",
  "특수학교 교사",
  "보건교사",
  "영양교사",
  "사서교사",
  "전문상담교사",
  "장학관",
  "장학사",
  "교육연구관",
  "교육연구사",
  "교수",
  "교장",
  "교감",
  "원장",
  "원감",
];

const SUBJECT_KEYWORDS = [...new Set([
  "국어",
  "수학",
  "영어",
  "사회",
  "역사",
  "지리",
  "도덕·윤리",
  "도덕",
  "윤리",
  "공통과학",
  "과학",
  "상업정보",
  "상업",
  "공업",
  "건설",
  "토목",
  "기계·금속",
  "자동차",
  "기계",
  "교련",
  "디자인·공예",
  "식품가공",
  "조리",
  "물리",
  "화학",
  "생물",
  "지구과학",
  "체육",
  "음악",
  "미술",
  "미용",
  "기술·가정",
  "기술",
  "가정",
  "공통사회",
  "일반사회",
  "전기·전자·통신",
  "전자계산",
  "전기",
  "전자",
  "정보",
  "정보·컴퓨터",
  "컴퓨터",
  "한문",
  "중국어",
  "일본어",
  "스페인어",
  "프랑스어",
  "독일어",
  "진로진학상담",
  "진로진학",
  "진로상담",
  "진로",
  "상담",
  "전문상담",
  "보건",
  "영양",
  "사서",
  "특수",
])];

const POSITION_ALIASES = {
  "중등학교장": "중등학교 교장",
  "초등학교장": "초등학교 교장",
  "특수학교장": "특수학교 교장",
  "유치원장": "유치원 원장",
  "중등교사": "중등학교 교사",
  "초등교사": "초등학교 교사",
  "특수교사": "특수학교 교사",
  "상담교사": "중등학교 교사",
  "교사": "중등학교 교사",
  "초빙교장": "중등학교 교장",
  "초빙교감": "중등학교 교감",
};

function normalizeText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[･․．ㆍ‧・]/g, "·")
    .replace(/～/g, "~")
    .replace(/디자인공예/g, "디자인·공예")
    .replace(/기\s*·\s*가/g, "기술·가정")
    .replace(/[ \t]+/g, " ")
    .replace(/(\d{4})\s+(\d{1,2}\.)/g, "$1. $2")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function splitRecords(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const compacted = compactText(normalized);
  const isTableBlock = (
    (compacted.includes("발령기관") && (compacted.includes("현임기관") || compacted.includes("현임교") || compacted.includes("소속교"))) ||
    (compacted.includes("신임교") && (compacted.includes("현임교") || compacted.includes("소속교"))) ||
    (compacted.includes("발령기관") && compacted.includes("신규"))
  );

  if (!isTableBlock) {
    const records = [];
    let start = 0;
    let match;
    DATE_RE.lastIndex = 0;
    while ((match = DATE_RE.exec(normalized)) !== null) {
      const end = match.index + match[0].length;
      const record = normalized.slice(start, end).trim();
      if (record) records.push(record);
      start = end;
    }
    const tail = normalized.slice(start).trim();
    if (tail && records.length === 0) records.push(tail);
    return records;
  }

  // 테이블이 여러 섹션으로 구성된 경우(헤더가 2개 이상) 독립 날짜 행으로 분리
  const lines = normalized.split("\n");
  const tableHeaderCount = lines.filter((line) => {
    const c = compactText(line);
    return (
      (c.includes("발령기관") && (c.includes("현임기관") || c.includes("현임교") || c.includes("소속교"))) ||
      c.includes("직위(급)성명현임기관") ||
      c.includes("직위(급)성명현임교") ||
      (c.includes("신임교") && (c.includes("현임교") || c.includes("소속교")))
    );
  }).length;

  if (tableHeaderCount <= 1) {
    return [normalized];
  }

  // 독립 날짜 행(행 전체가 날짜)을 섹션 경계로 삼아 분리
  const STANDALONE_DATE_RE = /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.$/;
  const sections = [];
  let sectionStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (STANDALONE_DATE_RE.test(lines[i].trim())) {
      const sectionText = lines.slice(sectionStart, i + 1).join("\n").trim();
      if (sectionText) sections.push(sectionText);
      sectionStart = i + 1;
    }
  }
  // 날짜나 테이블 헤더가 없는 잔여 텍스트(서명 등)는 섹션으로 추가하지 않음
  const remaining = lines.slice(sectionStart).join("\n").trim();
  if (remaining) {
    const rc = compactText(remaining);
    if (DATE_TEST_RE.test(remaining) || rc.includes("발령기관") || rc.includes("직위(급)성명현임기관") || rc.includes("신임교")) {
      sections.push(remaining);
    }
  }
  return sections.filter(Boolean);
}

function compactText(text) {
  return text.replace(/\s+/g, "");
}

function compactValue(text) {
  return compactText(text).trim();
}

function compactKeyword(keyword) {
  return keyword.replace(/\s+/g, "");
}

const POSITION_PATTERNS = [
  ...POSITION_KEYWORDS.map((position) => ({ keyword: compactKeyword(position), position })),
  ...Object.entries(POSITION_ALIASES).map(([keyword, position]) => ({ keyword, position })),
].sort((a, b) => b.keyword.length - a.keyword.length);

const POSITION_KEYWORD_SET = new Set(POSITION_KEYWORDS.map(compactKeyword));
const SORTED_SUBJECT_KEYWORDS = [...SUBJECT_KEYWORDS].sort((a, b) => b.length - a.length);

function normalizeSubject(subject) {
  return (subject || "").replace(/･/g, "·");
}

const ADMIN_SUFFIXES = ["대전광역시", "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "울산광역시", "세종특별자치시", "경기도", "강원도", "충청북도", "충청남도", "전라북도", "전라남도", "경상북도", "경상남도"];

function formatInstitutionName(value) {
  let compacted = compactValue(value).replace(/^[)）]+/, "").replace(/[.。]+$/g, "");
  if (!compacted || compacted === "신규") return compacted;

  // 공모·초빙 등 임용 방식 괄호는 기관명이 아니므로 앞에서 제거
  compacted = compacted.replace(/^\((?:공모|초빙)\)/, "");
  if (!compacted) return compacted;

  // 표 마지막 행에서 다음 줄 지시문의 행정구역명이 기관명 뒤에 붙는 경우 제거
  // 예: "충남여고대전광역시" → "충남여고"
  for (const suffix of ADMIN_SUFFIXES) {
    if (compacted.endsWith(suffix) && compacted.length > suffix.length) {
      compacted = compacted.slice(0, compacted.length - suffix.length);
      break;
    }
  }

  return compacted
    .replace(/^대전광역시(동부|서부)교육지원청/, "대전광역시 $1교육지원청")
    .replace(/^대전광역시교육청(.+)$/, "대전광역시교육청 $1");
}

function isInstructionSuffix(suffix) {
  if (suffix.startsWith("에임함") || suffix.startsWith("에보함")) return true;
  // 복합 임용 지시문: "장학사·교육연구사에임함" 처럼 "·직위에임함" 형태
  if (suffix.startsWith("·")) {
    const afterDot = suffix.slice(1);
    const inner = findPositionOccurrences(afterDot).find((p) => p.index === 0);
    if (inner) {
      const innerSuffix = afterDot.slice(inner.end);
      if (innerSuffix.startsWith("에임함") || innerSuffix.startsWith("에보함")) return true;
    }
  }
  return false;
}

function trimAppointmentInstruction(value) {
  const compacted = compactValue(value);
  const positionInstructionIndexes = findPositionOccurrences(compacted)
    .filter((item) => isInstructionSuffix(compacted.slice(item.end)))
    .map((item) => item.index);
  const stopIndexes = [
    ...positionInstructionIndexes,
    compacted.indexOf("교육공무원법"),
  ].filter((index) => index !== -1);
  const end = stopIndexes.length ? Math.min(...stopIndexes) : compacted.length;
  return compacted.slice(0, end);
}

const ORG_EXCLUSIONS = new Set(["급", "두서", "명예퇴직", "정년퇴직", "직위해제", "면직", "의원면직", "중등", "초등", "유아", "공모", "초빙"]);
const REGION_MARKERS = new Set([
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
]);

function isRegionMarker(value) {
  return REGION_MARKERS.has(compactValue(value));
}

function findOrganization(text) {
  const matches = [...text.matchAll(/\(([^)]+)\)/g)];
  for (const match of matches) {
    const value = compactValue(match[1]);
    if (value && !ORG_EXCLUSIONS.has(value)) return value;
  }
  return "";
}

function findPositionOccurrences(compacted) {
  const occurrences = [];

  for (const { keyword, position } of POSITION_PATTERNS) {
    let index = compacted.indexOf(keyword);
    while (index !== -1) {
      const end = index + keyword.length;
      const overlaps = occurrences.some((item) => index < item.end && end > item.index);
      if (!overlaps) occurrences.push({ position, index, end });
      index = compacted.indexOf(keyword, index + 1);
    }
  }

  return occurrences.sort((a, b) => a.index - b.index);
}

function findPosition(text) {
  const compacted = compactText(text);
  return findPositionOccurrences(compacted)[0]?.position || "";
}

function findName(text, position) {
  if (position) {
    const afterPosition = text.slice(text.indexOf(position) + position.length);
    const match = afterPosition.match(/\s*([가-힣]{2,4})(?=\s|$)/);
    if (match) return match[1];
  }

  const fallback = text.match(/(?:교사|장학관|장학사|교육연구관|교육연구사|교장|교감)\s+([가-힣]{2,4})(?=\s|$)/);
  return fallback ? fallback[1] : "";
}

function findSubject(text, name) {
  const searchArea = name && text.includes(name) ? text.slice(text.indexOf(name) + name.length) : text;
  return SORTED_SUBJECT_KEYWORDS.find((subject) => searchArea.includes(subject)) || "";
}

function findTerm(text) {
  // 첫 번째 날짜 끝의 점(.)은 없을 수도 있음 (예: 2013.3.1~2017.2.28.)
  const match = text.match(/(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*(?:부터|~|-)\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:까지)?)/);
  return match ? match[1].trim() : "";
}

function findDates(text) {
  return [...text.matchAll(DATE_RE)].map((match) => match[0].replace(/\s+/g, " "));
}

function isInstructionPosition(text, positionEntry) {
  return isInstructionSuffix(text.slice(positionEntry.end));
}

function parseTableRow(rowText, organization) {
  const positions = findPositionOccurrences(rowText);
  const currentPosition = positions.find((item) => item.index === 0) || positions[0];
  if (!currentPosition) return null;

  // 국장(장학관) 형태: 직위 키워드가 괄호 안에 있고 앞에 보직명이 붙은 경우
  let positionLabel = currentPosition.position;
  let positionEnd = currentPosition.end;
  if (
    currentPosition.index > 0 &&
    rowText[currentPosition.index - 1] === "(" &&
    rowText[currentPosition.end] === ")"
  ) {
    positionEnd = currentPosition.end + 1;
    const prefixText = rowText.slice(0, currentPosition.index - 1);
    if (prefixText) positionLabel = `${prefixText}(${currentPosition.position})`;
  }

  const afterCurrentPosition = rowText.slice(positionEnd);
  // 임용 지시문(에임함/에보함)으로 시작하면 데이터 행이 아님
  if (afterCurrentPosition.startsWith("에임함") || afterCurrentPosition.startsWith("에보함")) return null;
  const restPositions = findPositionOccurrences(afterCurrentPosition)
    .filter((item) => !isInstructionPosition(afterCurrentPosition, item));
  const prevPositionInRest = restPositions[0];
  const term = findTerm(afterCurrentPosition);

  // 이름 다음에 나오는 과목 탐색
  const searchLimit = prevPositionInRest ? prevPositionInRest.index : afterCurrentPosition.length;
  let subject = "";
  let subjectIndex = -1;
  const subjectCandidates = [];
  for (const kw of SORTED_SUBJECT_KEYWORDS) {
    const idx = afterCurrentPosition.indexOf(kw, 2);
    if (idx !== -1 && idx < searchLimit) {
      subjectCandidates.push({ subject: kw, index: idx });
    }
  }
  const preferredSubject = subjectCandidates.find((item) => item.index === 3)
    || subjectCandidates.sort((a, b) => a.index - b.index || b.subject.length - a.subject.length)[0];
  if (preferredSubject) {
    subject = preferredSubject.subject;
    subjectIndex = preferredSubject.index;
  }

  // 이름 끝: 과목 > 다음 직위 > 신규 순으로 경계 결정
  const nameEnd = subjectIndex !== -1
    ? subjectIndex
    : prevPositionInRest
      ? prevPositionInRest.index
      : afterCurrentPosition.indexOf("신규");
  const rawName = afterCurrentPosition.slice(0, nameEnd === -1 ? undefined : nameEnd);
  const name = rawName.match(/^[가-힣]{2,4}/)?.[0] || "";

  const prevPosition = prevPositionInRest
    ? {
        ...prevPositionInRest,
        index: positionEnd + prevPositionInRest.index,
        end: positionEnd + prevPositionInRest.end,
      }
    : null;

  // 현직위가 "보직명(직급)" 형태인 경우 보직명 추출 (예: "과장(장학관)")
  let prevPositionLabel = prevPositionInRest?.position || "";
  if (prevPositionInRest && afterCurrentPosition[prevPositionInRest.index - 1] === "(" && afterCurrentPosition[prevPositionInRest.end] === ")") {
    const textBeforeParen = afterCurrentPosition.slice(0, prevPositionInRest.index - 1);
    const posPrefix = textBeforeParen.match(/[가-힣]+$/)?.[0] || "";
    if (posPrefix) prevPositionLabel = `${posPrefix}(${prevPositionInRest.position})`;
  }

  // 현직위 키워드 바로 뒤에 임용 방식 괄호가 붙은 경우: 중등학교 교장(공모)
  if (prevPositionInRest && afterCurrentPosition[prevPositionInRest.end] === "(") {
    const qualifierMatch = /^\(([^)]+)\)/.exec(afterCurrentPosition.slice(prevPositionInRest.end));
    if (qualifierMatch) {
      const qualifier = compactValue(qualifierMatch[1]);
      if (["공모", "초빙"].includes(qualifier)) {
        prevPositionLabel = `${prevPositionLabel}(${qualifier})`;
      }
    }
  }

  let prevOrg = rowText.includes("신규") ? "신규" : "";
  if (prevPosition) {
    prevOrg = trimAppointmentInstruction(rowText.slice(prevPosition.end));
  } else if (subjectIndex !== -1) {
    const candidateOrg = trimAppointmentInstruction(afterCurrentPosition.slice(subjectIndex + subject.length));
    if (candidateOrg && !candidateOrg.endsWith("신규")) {
      prevOrg = candidateOrg;
    }
  }
  const normalizedPrevOrg = formatInstitutionName(prevOrg);

  return {
    organization: formatInstitutionName(organization),
    position: positionLabel,
    name,
    subject: normalizeSubject(subject),
    term,
    prev_position: normalizedPrevOrg === "신규" ? "" : prevPositionLabel || currentPosition.position,
    prev_org: normalizedPrevOrg,
  };
}

function findAliasedPosition(text) {
  for (const [alias, canonical] of Object.entries(POSITION_ALIASES)) {
    const idx = text.indexOf(alias);
    if (idx !== -1) return { position: canonical, index: idx, end: idx + alias.length };
  }
  return null;
}

function parseNameLeadRow(rowText) {
  const pickEarlier = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    return a.index <= b.index ? a : b;
  };

  // 첫 직위(풀 또는 단축형) 위치로 이름 경계 결정
  const firstInRow = pickEarlier(findPositionOccurrences(rowText)[0] || null, findAliasedPosition(rowText));
  const nameEnd = firstInRow?.index ?? 4;
  const name = rowText.slice(0, Math.min(nameEnd, 4)).match(/^[가-힣]{2,4}/)?.[0] || "";

  const afterName = rowText.slice(name.length);
  const prevPosEntry = pickEarlier(findPositionOccurrences(afterName)[0] || null, findAliasedPosition(afterName));
  const prev_position = prevPosEntry?.position || "";

  let prev_org = "";
  if (prevPosEntry) {
    const afterPrevPos = afterName.slice(prevPosEntry.end);
    const stopAt = Math.min(
      findPositionOccurrences(afterPrevPos)[0]?.index ?? Infinity,
      findAliasedPosition(afterPrevPos)?.index ?? Infinity,
    );
    prev_org = stopAt === Infinity ? afterPrevPos : afterPrevPos.slice(0, stopAt);
  }

  return { name, prev_position, prev_org: formatInstitutionName(trimAppointmentInstruction(prev_org)) };
}

function parseTableLikeRecords(text) {
  const compacted = compactText(text);
  const tableHeaderIndexes = [compacted.indexOf("발령기관"), compacted.indexOf("신임교")]
    .filter((index) => index !== -1);
  const tableHeaderIndex = tableHeaderIndexes.length ? Math.min(...tableHeaderIndexes) : -1;
  const hasTableTail = compacted.includes("현임기관") || compacted.includes("현임교") || compacted.includes("소속교") || compacted.includes("신규");
  if (tableHeaderIndex === -1 || !hasTableTail) {
    return [];
  }

  const tableText = compacted.slice(tableHeaderIndex);
  const allOrgMatches = [...tableText.matchAll(/\(([^)]+)\)/g)]
    .map((match) => ({
      index: match.index,
      end: match.index + match[0].length,
      organization: compactValue(match[1]),
    }))
    .filter((match) =>
      match.organization &&
      !ORG_EXCLUSIONS.has(match.organization) &&
      !isRegionMarker(match.organization),
    );

  const isPositionOrg = (org) => POSITION_KEYWORD_SET.has(compactKeyword(org));

  function calcRowEnd(startAfter, skipPositionOrgs = false) {
    const nextOrg = skipPositionOrgs
      ? allOrgMatches.find((m) => m.index > startAfter && !isPositionOrg(m.organization))
      : allOrgMatches.find((m) => m.index > startAfter);
    const instrIdx = tableText.indexOf("(두서)", startAfter);
    const candidates = [nextOrg?.index ?? -1, instrIdx].filter((c) => c !== -1);
    return candidates.length ? Math.min(...candidates) : tableText.length;
  }

  const rows = [];
  let i = 0;

  while (i < allOrgMatches.length) {
    const curr = allOrgMatches[i];

    if (isPositionOrg(curr.organization)) {
      i++;
      continue;
    }

    const next = allOrgMatches[i + 1];
    const nextIsPositionOrg = next && isPositionOrg(next.organization);

    if (nextIsPositionOrg) {
      const betweenContent = tableText.slice(curr.end, next.index);
      const firstPos = findPositionOccurrences(betweenContent)[0];
      const afterPosContent = firstPos ? betweenContent.slice(firstPos.end) : betweenContent;

      if (/[가-힣]/.test(afterPosContent)) {
        // 포지션 키워드 뒤에 이름 등 내용이 있으면 1행 내부 포지션 괄호 — 1행으로 처리
        const rowEnd = calcRowEnd(curr.end, true);
        const rowText = tableText.slice(curr.end, rowEnd);
        const parsed = parseTableRow(rowText, curr.organization);
        if (parsed) {
          if (!parsed.prev_org) {
            const nextOrgAtBoundary = allOrgMatches.find((m) => m.index === rowEnd && !isPositionOrg(m.organization));
            if (nextOrgAtBoundary) {
              parsed.prev_org = formatInstitutionName(nextOrgAtBoundary.organization);
            }
          }
          rows.push(parsed);
        }
        i++;
      } else {
        // 2행 포맷: (기관) 직위\n(직급) 이름 현직위 현임기관
        const basePosition = firstPos?.position || "";
        const combinedPosition = basePosition ? `${basePosition}(${next.organization})` : next.organization;

        const dataText = tableText.slice(next.end, calcRowEnd(next.end));
        const { name, prev_position, prev_org } = parseNameLeadRow(dataText);

        rows.push({
          organization: formatInstitutionName(curr.organization),
          position: combinedPosition,
          name,
          subject: "",
          prev_position,
          prev_org,
        });
        i += 2;
      }
    } else {
      // 현재 기관 괄호 바로 뒤에 다른 기관 괄호가 붙어있으면 현임기관 괄호이므로 건너뜀
      if (next && next.index === curr.end) {
        i++;
        continue;
      }
      const rowEnd = calcRowEnd(curr.end);
      const rowText = tableText.slice(curr.end, rowEnd);
      const parsed = parseTableRow(rowText, curr.organization);
      if (parsed) {
        // prev_org가 없고 행 경계 바로 다음에 기관 괄호가 있으면 현임기관으로 사용
        if (!parsed.prev_org) {
          const nextOrgAtBoundary = allOrgMatches.find((m) => m.index === rowEnd && !isPositionOrg(m.organization));
          if (nextOrgAtBoundary) {
            parsed.prev_org = formatInstitutionName(nextOrgAtBoundary.organization);
          }
        }
        rows.push(parsed);
      }
      i++;
    }
  }

  return rows;
}

function parseTableLikeRecord(text) {
  return parseTableLikeRecords(text)[0] || null;
}

function findPositionAtStart(text) {
  const positions = findPositionOccurrences(compactText(text));
  return positions.find((item) => item.index === 0)?.position || "";
}

function stripPositionFromStart(text, position) {
  const trimmed = text.trim();
  const compacted = compactText(trimmed);
  const positionKeywords = [
    compactKeyword(position),
    ...Object.entries(POSITION_ALIASES)
      .filter(([, canonical]) => canonical === position)
      .map(([alias]) => alias),
  ];
  const matchedKeyword = positionKeywords.find((keyword) => compacted.startsWith(keyword));
  if (!matchedKeyword) return trimmed;

  let consumed = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    if (/\s/.test(trimmed[i])) continue;
    consumed += 1;
    if (consumed === matchedKeyword.length) {
      return trimmed.slice(i + 1).trim();
    }
  }
  return "";
}

function splitSpacedNameAndOrg(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { name: "", prev_org: "" };

  if (tokens.length >= 4 && tokens.slice(0, 3).every((token) => /^[가-힣]$/.test(token))) {
    return {
      name: tokens.slice(0, 3).join(""),
      prev_org: formatInstitutionName(tokens.slice(3).join("")),
    };
  }

  const compacted = compactValue(text);
  return {
    name: compacted.slice(0, Math.min(3, compacted.length)),
    prev_org: formatInstitutionName(compacted.slice(Math.min(3, compacted.length))),
  };
}

function isPositionLine(line) {
  if (findPositionAtStart(line)) return true;
  const c = compactText(line);
  const m = /^([가-힣]+)\(([^)]+)\)/.exec(c);
  return m ? POSITION_KEYWORD_SET.has(compactValue(m[2])) : false;
}

function parseRetirementLikeRecords(text) {
  const compacted = compactText(text);
  const RETIREMENT_TYPES = ["정년퇴직", "명예퇴직", "의원면직"];
  const hasRetirementHeader =
    compacted.includes("직위(급)성명현임기관") ||
    compacted.includes("직위(급)성명현임교");
  if (!hasRetirementHeader || !RETIREMENT_TYPES.some((type) => compacted.includes(type))) return [];
  const retirementType = RETIREMENT_TYPES.find((type) => compacted.includes(type)) || "퇴직";

  const lines = normalizeText(text).split("\n");
  const headerLineIndex = lines.findIndex((line) => {
    const compactedLine = compactText(line);
    return compactedLine.includes("직위(급)성명현임기관") || compactedLine.includes("직위(급)성명현임교");
  });
  if (headerLineIndex === -1) return [];

  // 유효 데이터 행 수집 (교육공무원법/날짜 전까지)
  const dataLines = [];
  for (const line of lines.slice(headerLineIndex + 1)) {
    const c = compactText(line);
    DATE_RE.lastIndex = 0;
    if (!c || c.includes("교육공무원법") || DATE_TEST_RE.test(line)) break;
    dataLines.push(line);
  }

  // 2행 포맷 감지: 행이 (직급) 으로 시작하는 경우
  const twoRowLineIndices = dataLines.reduce((acc, line, i) => {
    const c = compactText(line);
    const m = /^\(([^)]+)\)/.exec(c);
    const candidate = m ? compactValue(m[1]) : null;
    if (candidate && POSITION_KEYWORD_SET.has(candidate)) acc.push(i);
    return acc;
  }, []);

  const records = [];

  if (twoRowLineIndices.length > 0) {
    // 2행 포맷: 보직명\n(직급) 이름 현임기관 [현임기관 계속...]
    for (let k = 0; k < twoRowLineIndices.length; k++) {
      const dataIdx = twoRowLineIndices[k];
      const nextDataIdx = twoRowLineIndices[k + 1];

      const positionTitle = dataIdx > 0 ? compactValue(dataLines[dataIdx - 1]) : "";
      const compactedDataLine = compactText(dataLines[dataIdx]);
      const m = /^\(([^)]+)\)/.exec(compactedDataLine);
      const posKeyword = compactValue(m[1]);
      const resolvedPos = POSITION_PATTERNS.find((p) => p.keyword === posKeyword)?.position || posKeyword;

      // 이름/현임기관 경계 추출은 공백 보존 텍스트로 처리 (splitSpacedNameAndOrg 활용)
      const normalizedDataLine = dataLines[dataIdx];
      const closingParenIdx = normalizedDataLine.indexOf(")");
      const afterGradeNormalized = closingParenIdx !== -1
        ? normalizedDataLine.slice(closingParenIdx + 1).trim()
        : normalizedDataLine;

      // 현임기관이 다음 줄로 이어지는 경우 합산 (다음 보직명 행 직전까지)
      const continuationEnd = nextDataIdx !== undefined ? nextDataIdx - 1 : dataLines.length;
      const continuationNormalized = dataLines.slice(dataIdx + 1, continuationEnd).map((l) => l.trim()).join(" ");
      const combinedNormalized = afterGradeNormalized + (continuationNormalized ? " " + continuationNormalized : "");

      const { name, prev_org } = splitSpacedNameAndOrg(combinedNormalized);
      const fullPosition = positionTitle ? `${positionTitle}(${resolvedPos})` : resolvedPos;

      records.push({
        organization: retirementType,
        position: fullPosition,
        name,
        prev_position: fullPosition,
        prev_org,
      });
    }
  } else {
    // 1행 포맷
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const compactedLine = compactText(line);

      let fullPosition = "";
      let afterPosition = "";

      const posAtStart = findPositionAtStart(line);
      if (posAtStart) {
        let rest = stripPositionFromStart(line, posAtStart);
        const suffixMatch = rest.match(/^\s*\(([^)]+)\)\s*/);
        if (suffixMatch) {
          fullPosition = `${posAtStart}(${compactValue(suffixMatch[1])})`;
          afterPosition = rest.slice(suffixMatch[0].length).trim();
        } else {
          fullPosition = posAtStart;
          afterPosition = rest.trim();
        }
      } else {
        // 보직명(직급) 형태: "교육정책국장(장학관) 이름 현임기관"
        const m = /^([가-힣]+)\s*\(([^)]+)\)/.exec(compactedLine);
        if (m) {
          const rankCompacted = compactValue(m[2]);
          if (POSITION_KEYWORD_SET.has(rankCompacted)) {
            const resolvedPos = POSITION_PATTERNS.find((p) => p.keyword === rankCompacted)?.position || rankCompacted;
            fullPosition = `${m[1]}(${resolvedPos})`;
            const closeParenIdx = line.indexOf(")");
            afterPosition = closeParenIdx !== -1 ? line.slice(closeParenIdx + 1).trim() : "";
          }
        }
      }

      if (!fullPosition) continue;

      const { name, prev_org: directOrg } = splitSpacedNameAndOrg(afterPosition);

      // 현임기관이 다음 행으로 이어지는 경우 합산
      let prev_org = directOrg;
      if (i + 1 < dataLines.length && !isPositionLine(dataLines[i + 1])) {
        prev_org = formatInstitutionName(prev_org + compactValue(dataLines[i + 1]));
        i++;
      }

      records.push({
        organization: retirementType,
        position: fullPosition,
        name,
        prev_position: fullPosition,
        prev_org,
      });
    }
  }

  return records;
}

function findPrevPosition(text, currentPosition) {
  for (const position of POSITION_KEYWORDS) {
    const explicitPattern = new RegExp(`(?:현직위|현직위급|현\\s*직위|현)\\s*[:：]?\\s*${position.replace(/\s+/g, "\\s*")}`);
    if (explicitPattern.test(text)) return position;
  }

  const currentIndex = currentPosition ? text.indexOf(currentPosition) : -1;
  for (const position of POSITION_KEYWORDS) {
    let searchIndex = 0;
    while (true) {
      const foundIndex = text.indexOf(position, searchIndex);
      if (foundIndex === -1) break;
      const context = text.slice(Math.max(0, foundIndex - 12), foundIndex);
      if (foundIndex !== currentIndex && /현\s*$/.test(context)) return position;
      searchIndex = foundIndex + position.length;
    }
  }

  return "";
}

function confidenceFor(record) {
  const required = ["organization", "position", "name", "appointment_date"];
  const hit = required.filter((key) => record[key]).length;
  return Number((hit / required.length).toFixed(2));
}

function warningsFor(record) {
  const warnings = [];
  if (!record.organization) warnings.push("organization not found");
  if (!record.position) warnings.push("position not found");
  if (!record.name) warnings.push("name not found");
  if (!record.appointment_date) warnings.push("appointment_date not found");
  return warnings;
}

function finalizeRecord(row, text, appointmentDate) {
  const parsed = {
    organization: row.organization || "",
    position: row.position || "",
    name: row.name || "",
    subject: normalizeSubject(row.subject || ""),
    term: row.term || "",
    prev_position: row.prev_position || "",
    prev_org: row.prev_org || "",
    appointment_date: appointmentDate || "",
    raw_text: text,
  };
  parsed.parse_confidence = confidenceFor(parsed);
  parsed.parse_warnings = warningsFor(parsed);
  parsed.parse_status = parsed.parse_warnings.length ? "needs_review" : "parsed";
  parsed.memo = "";
  return parsed;
}

export function parseAppointmentRecord(rawText) {
  const text = normalizeText(rawText);
  const tableParsed = parseTableLikeRecord(text);
  const dates = findDates(text);
  const organization = tableParsed?.organization || findOrganization(text);
  const position = tableParsed?.position || findPosition(text);
  const name = tableParsed?.name || findName(text, position);
  const subject = tableParsed ? "" : normalizeSubject(findSubject(text, name));
  const term = tableParsed?.term || findTerm(text);
  const termDates = term ? new Set(findDates(term)) : new Set();
  const appointment_date = dates.filter((d) => !termDates.has(d)).at(-1) || "";
  const prev_org = tableParsed?.prev_org || (text.includes("신규") ? "신규" : "");
  const prev_position = tableParsed?.prev_position || findPrevPosition(text, position);

  return finalizeRecord({
    organization,
    position,
    name,
    subject,
    term,
    prev_position,
    prev_org,
  }, text, appointment_date);
}

export function parseAppointmentRecords(rawText) {
  const text = normalizeText(rawText);
  const retirementRows = parseRetirementLikeRecords(text);
  if (retirementRows.length) {
    const dates = findDates(text);
    const appointment_date = dates.at(-1) || "";

    return retirementRows.map((row) => finalizeRecord(row, text, appointment_date));
  }

  const tableRows = parseTableLikeRecords(text);
  if (!tableRows.length) return [parseAppointmentRecord(rawText)];

  const dates = findDates(text);
  const termDates = new Set(tableRows.flatMap((row) => (row.term ? findDates(row.term) : [])));
  const appointment_date = dates.filter((d) => !termDates.has(d)).at(-1) || "";

  return tableRows.map((row) => finalizeRecord(row, text, appointment_date));
}

export function parseAppointments(text) {
  return splitRecords(text).flatMap(parseAppointmentRecords);
}
