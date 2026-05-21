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
  "과학",
  "건설",
  "기계·금속",
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
  "일반사회",
  "전기·전자·통신",
  "전자",
  "정보",
  "정보·컴퓨터",
  "한문",
  "중국어",
  "일본어",
  "스페인어",
  "프랑스어",
  "독일어",
  "진로",
  "진로진학상담",
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
};

function normalizeText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/･/g, "·")
    .replace(/[ \t]+/g, " ")
    .replace(/(\d{4})\s+(\d{1,2}\.)/g, "$1. $2")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function splitRecords(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const compacted = compactText(normalized);
  if (
    (compacted.includes("발령기관") && compacted.includes("현임기관")) ||
    (compacted.includes("신임교") && compacted.includes("현임교"))
  ) {
    return [normalized];
  }

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

function formatInstitutionName(value) {
  const compacted = compactValue(value).replace(/[.。]+$/g, "");
  if (!compacted || compacted === "신규") return compacted;

  return compacted
    .replace(/^대전광역시(동부|서부)교육지원청/, "대전광역시 $1교육지원청")
    .replace(/^대전광역시교육청(.+)$/, "대전광역시교육청 $1");
}

function trimAppointmentInstruction(value) {
  const compacted = compactValue(value);
  const positionInstructionIndexes = findPositionOccurrences(compacted)
    .filter((item) => {
      const suffix = compacted.slice(item.end);
      return suffix.startsWith("에임함") || suffix.startsWith("에보함");
    })
    .map((item) => item.index);
  const stopIndexes = [
    ...positionInstructionIndexes,
    compacted.indexOf("교육공무원법"),
  ].filter((index) => index !== -1);
  const end = stopIndexes.length ? Math.min(...stopIndexes) : compacted.length;
  return compacted.slice(0, end);
}

const ORG_EXCLUSIONS = new Set(["급", "두서", "명예퇴직", "정년퇴직", "직위해제", "면직", "의원면직"]);
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
  const match = text.match(/(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:부터|~|-)\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:까지)?)/);
  return match ? match[1].trim() : "";
}

function findDates(text) {
  return [...text.matchAll(DATE_RE)].map((match) => match[0].replace(/\s+/g, " "));
}

function isInstructionPosition(text, positionEntry) {
  const suffix = text.slice(positionEntry.end);
  return suffix.startsWith("에임함") || suffix.startsWith("에보함");
}

function parseTableRow(rowText, organization) {
  const positions = findPositionOccurrences(rowText);
  const currentPosition = positions.find((item) => item.index === 0) || positions[0];
  if (!currentPosition) return null;

  const afterCurrentPosition = rowText.slice(currentPosition.end);
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
        index: currentPosition.end + prevPositionInRest.index,
        end: currentPosition.end + prevPositionInRest.end,
      }
    : null;

  let prevOrg = rowText.includes("신규") ? "신규" : "";
  if (prevPosition) {
    prevOrg = trimAppointmentInstruction(rowText.slice(prevPosition.end));
  } else if (subjectIndex !== -1) {
    prevOrg = trimAppointmentInstruction(afterCurrentPosition.slice(subjectIndex + subject.length));
  }
  const normalizedPrevOrg = formatInstitutionName(prevOrg);

  return {
    organization: formatInstitutionName(organization),
    position: currentPosition.position,
    name,
    subject: normalizeSubject(subject),
    term,
    // 현직위 명시 없으면 발령 직위와 동일 (전보)
    prev_position: normalizedPrevOrg === "신규" ? "" : prevPosition?.position || currentPosition.position,
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
  const hasTableTail = compacted.includes("현임기관") || compacted.includes("현임교");
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
      match.organization !== "급" &&
      match.organization !== "두서" &&
      !isRegionMarker(match.organization),
    );

  const isPositionOrg = (org) => POSITION_KEYWORD_SET.has(compactKeyword(org));

  function calcRowEnd(startAfter) {
    const nextOrg = allOrgMatches.find((m) => m.index > startAfter);
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
      // 2행 포맷: (기관) 직위\n(직급) 이름 현직위 현임기관
      const betweenOrgs = tableText.slice(curr.end, next.index);
      const basePosition = findPositionOccurrences(betweenOrgs)[0]?.position || "";
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
    } else {
      const rowText = tableText.slice(curr.end, calcRowEnd(curr.end));
      const parsed = parseTableRow(rowText, curr.organization);
      if (parsed) rows.push(parsed);
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

  const records = [];
  for (const line of lines.slice(headerLineIndex + 1)) {
    const compactedLine = compactText(line);
    DATE_RE.lastIndex = 0;
    if (!compactedLine || compactedLine.includes("교육공무원법") || DATE_TEST_RE.test(line)) break;

    const position = findPositionAtStart(line);
    if (!position) continue;

    const rest = stripPositionFromStart(line, position);
    const { name, prev_org } = splitSpacedNameAndOrg(rest);
    records.push({
      organization: retirementType,
      position,
      name,
      prev_position: position,
      prev_org,
    });
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
  const appointment_date = dates.at(-1) || "";
  const term = findTerm(text);
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
  const appointment_date = dates.at(-1) || "";

  return tableRows.map((row) => finalizeRecord(row, text, appointment_date));
}

export function parseAppointments(text) {
  return splitRecords(text).flatMap(parseAppointmentRecords);
}
