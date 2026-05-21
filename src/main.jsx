import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = "http://127.0.0.1:4000/api";

const FIELDS = [
  ["organization", "발령기관"],
  ["position", "직위"],
  ["name", "성명"],
  ["subject", "과목"],
  ["term", "임용기간"],
  ["prev_position", "현직위"],
  ["prev_org", "현임기관"],
  ["appointment_date", "발령일자"],
];

const SAMPLE_TEXT = `(OO고) 중등학교 교사 홍길동 국어 신규
중등학교 교사에 임함. (두 서) 학교 근무를 명함. 2026. 5. 1.`;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청 처리 중 오류가 발생했습니다.");
  return data;
}

function EditableCell({ value, onChange }) {
  return (
    <input
      className="cell-input"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ParsePanel({ onSaved }) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function parseText() {
    setBusy(true);
    setMessage("");
    try {
      const data = await request("/parse", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setItems(data.items || []);
      setMessage(`${data.items?.length || 0}건을 파싱했습니다.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (!items.length) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await request("/appointments/bulk", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setMessage(`${data.inserted}건을 저장했습니다.`);
      setItems([]);
      onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function updateItem(index, key, value) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value, parse_status: "manual" } : item,
      ),
    );
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>원문 입력 및 파싱</h2>
          <p>한글/PDF에서 복사한 인사 발령 텍스트를 붙여넣고 정형 데이터로 변환합니다.</p>
        </div>
        <div className="actions">
          <button onClick={parseText} disabled={busy}>파싱하기</button>
          <button className="secondary" onClick={saveAll} disabled={busy || !items.length}>전체 저장</button>
        </div>
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} />
      {message && <div className="message">{message}</div>}

      {items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>상태</th>
                {FIELDS.map(([, label]) => <th key={label}>{label}</th>)}
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <span className={`badge ${item.parse_status === "parsed" ? "ok" : "warn"}`}>
                      {item.parse_status === "parsed" ? "확인" : "검수"}
                    </span>
                  </td>
                  {FIELDS.map(([key]) => (
                    <td key={key}>
                      <EditableCell value={item[key]} onChange={(value) => updateItem(index, key, value)} />
                    </td>
                  ))}
                  <td><button className="icon-btn" onClick={() => removeItem(index)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ListPanel({ refreshToken }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState({
    name: "",
    organization: "",
    subject: "",
    appointment_date: "",
    prev_org: "",
  });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({});
  const [sort, setSort] = useState({ field: "", order: "asc" });

  async function load(nextPage = page, nextSort = sort) {
    const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
    Object.entries(query).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    if (nextSort.field) {
      params.set("sort_by", nextSort.field);
      params.set("sort_order", nextSort.order);
    }
    try {
      const data = await request(`/appointments?${params.toString()}`);
      setItems(data.items || []);
      setMeta({ total: data.total || 0, pages: data.pages || 1 });
      setPage(data.page || nextPage);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleSort(field) {
    const nextSort = {
      field,
      order: sort.field === field && sort.order === "asc" ? "desc" : "asc",
    };
    setSort(nextSort);
    load(1, nextSort);
  }

  function sortIndicator(field) {
    if (sort.field !== field) return "";
    return sort.order === "asc" ? " ▲" : " ▼";
  }

  async function remove(id) {
    if (!confirm("삭제할까요?")) return;
    try {
      await request(`/appointments/${id}`, { method: "DELETE" });
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(item) {
    setEditingId(item._id);
    setDraft(Object.fromEntries(FIELDS.map(([key]) => [key, item[key] || ""])));
  }

  function cancelEdit() {
    setEditingId("");
    setDraft({});
  }

  async function saveEdit(id) {
    try {
      await request(`/appointments/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, parse_status: "manual" }),
      });
      setEditingId("");
      setDraft({});
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleFilterKeyDown(event) {
    if (event.key === "Enter") {
      load(1);
    }
  }

  useEffect(() => {
    load(1);
  }, [refreshToken]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>저장 데이터</h2>
          <p>부분 일치로 이름, 기관, 과목, 현임기관, 발령일을 검색합니다.</p>
        </div>
        <button onClick={() => load(1)}>검색</button>
      </div>
      <div className="filters" onKeyDown={handleFilterKeyDown}>
        <input placeholder="이름" value={query.name} onChange={(e) => setQuery({ ...query, name: e.target.value })} />
        <input placeholder="기관" value={query.organization} onChange={(e) => setQuery({ ...query, organization: e.target.value })} />
        <input placeholder="과목" value={query.subject} onChange={(e) => setQuery({ ...query, subject: e.target.value })} />
        <input placeholder="현임기관" value={query.prev_org} onChange={(e) => setQuery({ ...query, prev_org: e.target.value })} />
        <input placeholder="발령일" value={query.appointment_date} onChange={(e) => setQuery({ ...query, appointment_date: e.target.value })} />
      </div>
      {message && <div className="message error">{message}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {FIELDS.map(([key, label]) => (
                <th key={key}>
                  <button className="sort-header" type="button" onClick={() => handleSort(key)}>
                    {label}{sortIndicator(key)}
                  </button>
                </th>
              ))}
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                {FIELDS.map(([key]) => (
                  <td key={key}>
                    {editingId === item._id ? (
                      <EditableCell
                        value={draft[key]}
                        onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
                      />
                    ) : (
                      item[key]
                    )}
                  </td>
                ))}
                <td>
                  {editingId === item._id ? (
                    <div className="row-actions">
                      <button onClick={() => saveEdit(item._id)}>저장</button>
                      <button className="secondary" onClick={cancelEdit}>취소</button>
                    </div>
                  ) : (
                    <div className="row-actions">
                      <button className="secondary" onClick={() => startEdit(item)}>수정</button>
                      <button className="icon-btn" onClick={() => remove(item._id)}>삭제</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={FIELDS.length + 1} className="empty">저장된 데이터가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button className="secondary" disabled={page <= 1} onClick={() => load(page - 1)}>이전</button>
        <span>{page} / {meta.pages} 페이지, 총 {meta.total}건</span>
        <button className="secondary" disabled={page >= meta.pages} onClick={() => load(page + 1)}>다음</button>
      </div>
    </section>
  );
}

function App() {
  const [refreshToken, setRefreshToken] = useState(0);
  return (
    <main>
      <header>
        <h1>교육청 인사 발령 관리</h1>
        <p>비정형 인사 발령 텍스트를 정형 데이터로 변환하고 검수해 저장합니다.</p>
      </header>
      <ParsePanel onSaved={() => setRefreshToken((value) => value + 1)} />
      <ListPanel refreshToken={refreshToken} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
