import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.PROD ? "/api" : "http://127.0.0.1:4000/api";

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
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // httpOnly 쿠키 자동 전송
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청 처리 중 오류가 발생했습니다.");
  return data;
}

// ─── 로그인 페이지 ───────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>교육청 인사 발령 관리</h1>
        <p>시스템을 사용하려면 로그인이 필요합니다.</p>
        {error && <div className="message error">{error}</div>}
        <div className="login-field">
          <label>아이디</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디 입력"
            autoFocus
            required
          />
        </div>
        <div className="login-field">
          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            required
          />
        </div>
        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: "8px" }}>
          {busy ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}

// ─── 비밀번호 변경 모달 ───────────────────────────────────────────

function ChangePasswordModal({ onClose, onLogout }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (form.newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    try {
      await request("/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
      onLogout();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>비밀번호 변경</h2>
        {error && <div className="message error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>현재 비밀번호</label>
            <input type="password" value={form.currentPassword} onChange={update("currentPassword")} autoFocus required />
          </div>
          <div className="login-field">
            <label>새 비밀번호</label>
            <input type="password" value={form.newPassword} onChange={update("newPassword")} required />
          </div>
          <div className="login-field">
            <label>새 비밀번호 확인</label>
            <input type="password" value={form.confirmPassword} onChange={update("confirmPassword")} required />
          </div>
          <div className="actions" style={{ marginTop: "16px" }}>
            <button type="submit" disabled={busy}>{busy ? "변경 중..." : "변경"}</button>
            <button type="button" className="secondary" onClick={onClose}>취소</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 공통 컴포넌트 ────────────────────────────────────────────────

function EditableCell({ value, onChange }) {
  return (
    <input
      className="cell-input"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

// ─── 일반 사용자 조회 페이지 ──────────────────────────────────────

function UserView() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState({
    name: "", organization: "", subject: "", appointment_date: "",
  });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState(false);

  async function load(nextPage = page) {
    const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
    Object.entries(query).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    try {
      const data = await request(`/appointments?${params.toString()}`);
      setItems(data.items || []);
      setMeta({ total: data.total || 0, pages: data.pages || 1 });
      setPage(data.page || nextPage);
      setSearched(true);
    } catch (err) {
      setMessage(err.message);
    }
  }

  function handleSearch() {
    load(1);
  }

  function handleFilterKeyDown(event) {
    if (event.key === "Enter") load(1);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>인사 발령 조회</h2>
          <p>이름, 기관, 과목, 발령일을 입력하고 검색하세요.</p>
        </div>
        <button onClick={handleSearch}>검색</button>
      </div>
      <div className="filters" onKeyDown={handleFilterKeyDown}>
        <input placeholder="이름" value={query.name} onChange={(e) => setQuery({ ...query, name: e.target.value })} />
        <input placeholder="기관" value={query.organization} onChange={(e) => setQuery({ ...query, organization: e.target.value })} />
        <input placeholder="과목" value={query.subject} onChange={(e) => setQuery({ ...query, subject: e.target.value })} />
        <input placeholder="발령일" value={query.appointment_date} onChange={(e) => setQuery({ ...query, appointment_date: e.target.value })} />
      </div>
      {message && <div className="message error">{message}</div>}

      {searched && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {FIELDS.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    {FIELDS.map(([key]) => (
                      <td key={key}>{item[key]}</td>
                    ))}
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={FIELDS.length} className="empty">검색 결과가 없습니다.</td>
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
        </>
      )}
    </section>
  );
}

// ─── 관리자 전용: 파싱 패널 ───────────────────────────────────────

function ParsePanel({ onSaved }) {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState([]);

  async function parseText() {
    setBusy(true);
    setMessage("");
    setDuplicates([]);
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

  async function doSave(itemsToSave) {
    try {
      const data = await request("/appointments/bulk", {
        method: "POST",
        body: JSON.stringify({ items: itemsToSave }),
      });
      setMessage(`${data.inserted}건을 저장했습니다.`);
      setItems([]);
      setDuplicates([]);
      onSaved();
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
    setDuplicates([]);
    try {
      const { duplicates: found } = await request("/appointments/check-duplicates", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      if (found.length > 0) {
        setDuplicates(found);
        setBusy(false);
        return;
      }
      await doSave(items);
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  function saveWithoutDuplicates() {
    const dupIndexes = new Set(duplicates.map((d) => d.index));
    doSave(items.filter((_, i) => !dupIndexes.has(i)));
  }

  function saveIncludingDuplicates() {
    doSave(items);
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

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `parsed-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <button className="secondary" onClick={downloadJSON} disabled={!items.length}>JSON 다운로드</button>
          <button className="secondary" onClick={saveAll} disabled={busy || !items.length}>전체 저장</button>
        </div>
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} />
      {message && <div className="message">{message}</div>}

      {duplicates.length > 0 && (
        <div className="message error">
          <strong>중복 데이터 {duplicates.length}건이 발견됐습니다.</strong>
          <ul style={{ margin: "6px 0 10px", paddingLeft: "18px" }}>
            {duplicates.map((d) => (
              <li key={d.index}>{d.name} / {d.organization} / {d.appointment_date}</li>
            ))}
          </ul>
          <div className="actions">
            <button onClick={saveWithoutDuplicates} disabled={busy}>중복 제외하고 저장</button>
            <button className="secondary" onClick={saveIncludingDuplicates} disabled={busy}>전체 저장</button>
            <button className="secondary" onClick={() => setDuplicates([])}>취소</button>
          </div>
        </div>
      )}

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
                <tr key={index} className={duplicates.some((d) => d.index === index) ? "dup-row" : ""}>
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

// ─── 관리자 전용: 저장 데이터 패널 ───────────────────────────────

function ListPanel({ refreshToken }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState({
    name: "", organization: "", subject: "", appointment_date: "", prev_org: "",
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
    if (event.key === "Enter") load(1);
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

// ─── 관리자 전용: JSON 가져오기 패널 ─────────────────────────────

function ImportPanel({ onSaved }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setBusy(true);
    setMessage("");
    setDuplicates([]);
    setPendingItems([]);
    try {
      const text = await file.text();
      const items = JSON.parse(text);
      if (!Array.isArray(items) || !items.length) {
        setMessage("유효한 데이터가 없습니다.");
        return;
      }
      const { duplicates: found } = await request("/appointments/check-duplicates", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      if (found.length > 0) {
        setDuplicates(found);
        setPendingItems(items);
        return;
      }
      await doImport(items);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doImport(items) {
    try {
      const data = await request("/appointments/bulk", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setMessage(`${data.inserted}건을 가져왔습니다.`);
      setDuplicates([]);
      setPendingItems([]);
      onSaved();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  function importWithoutDuplicates() {
    const dupIdx = new Set(duplicates.map((d) => d.index));
    doImport(pendingItems.filter((_, i) => !dupIdx.has(i)));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>JSON 가져오기</h2>
          <p>export-by-date.mjs로 내보낸 JSON 파일을 선택해 가져옵니다.</p>
        </div>
        <label style={{ cursor: "pointer" }}>
          <input type="file" accept=".json" style={{ display: "none" }} onChange={handleFile} disabled={busy} />
          <span className="btn">{busy ? "처리 중..." : "파일 선택"}</span>
        </label>
      </div>
      {message && <div className="message">{message}</div>}
      {duplicates.length > 0 && (
        <div className="message error">
          <strong>중복 데이터 {duplicates.length}건이 발견됐습니다.</strong>
          <ul style={{ margin: "6px 0 10px", paddingLeft: "18px" }}>
            {duplicates.map((d) => (
              <li key={d.index}>{d.name} / {d.organization} / {d.appointment_date}</li>
            ))}
          </ul>
          <div className="actions">
            <button onClick={importWithoutDuplicates} disabled={busy}>중복 제외하고 가져오기</button>
            <button className="secondary" onClick={() => { setBusy(true); doImport(pendingItems); }} disabled={busy}>전체 가져오기</button>
            <button className="secondary" onClick={() => { setDuplicates([]); setPendingItems([]); }}>취소</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── 관리자 전용: 계정 관리 패널 ─────────────────────────────────

function UserManagePanel() {
  const [users, setUsers] = useState([]);
  const [editingUsername, setEditingUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState({ text: "", isError: false });

  async function loadUsers() {
    try {
      const data = await request("/auth/users");
      setUsers(data.users || []);
    } catch (err) {
      setMessage({ text: err.message, isError: true });
    }
  }

  useEffect(() => { loadUsers(); }, []);

  function startEdit(username) {
    setEditingUsername(username);
    setNewPassword("");
    setMessage({ text: "", isError: false });
  }

  function cancelEdit() {
    setEditingUsername("");
    setNewPassword("");
  }

  async function handleReset(username) {
    if (newPassword.length < 8) {
      setMessage({ text: "비밀번호는 8자 이상이어야 합니다.", isError: true });
      return;
    }
    try {
      await request(`/auth/users/${encodeURIComponent(username)}/password`, {
        method: "PUT",
        body: JSON.stringify({ newPassword }),
      });
      setMessage({ text: `${username} 비밀번호가 변경되었습니다.`, isError: false });
      cancelEdit();
    } catch (err) {
      setMessage({ text: err.message, isError: true });
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>계정 관리</h2>
          <p>사용자 비밀번호를 초기화합니다.</p>
        </div>
      </div>
      {message.text && (
        <div className={`message${message.isError ? " error" : ""}`}>{message.text}</div>
      )}
      <table style={{ minWidth: 0, width: "100%" }}>
        <thead>
          <tr>
            <th>아이디</th>
            <th>권한</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.username}>
              <td>{u.username}</td>
              <td>
                <span className={`badge ${u.role === "admin" ? "ok" : "role-user"}`}>
                  {u.role === "admin" ? "관리자" : "사용자"}
                </span>
              </td>
              <td>
                {editingUsername === u.username ? (
                  <div className="actions">
                    <input
                      type="password"
                      placeholder="새 비밀번호 (8자 이상)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleReset(u.username)}
                      autoFocus
                      style={{ width: "220px" }}
                    />
                    <button onClick={() => handleReset(u.username)}>변경</button>
                    <button className="secondary" onClick={cancelEdit}>취소</button>
                  </div>
                ) : (
                  <button className="secondary" onClick={() => startEdit(u.username)}>
                    비밀번호 변경
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ─── 관리자 뷰 (파싱 + 저장 데이터) ─────────────────────────────

function AdminView() {
  const [refreshToken, setRefreshToken] = useState(0);
  return (
    <>
      <ParsePanel onSaved={() => setRefreshToken((v) => v + 1)} />
      <ImportPanel onSaved={() => setRefreshToken((v) => v + 1)} />
      <ListPanel refreshToken={refreshToken} />
      <UserManagePanel />
    </>
  );
}

// ─── 앱 루트 ─────────────────────────────────────────────────────

function App() {
  // null = 로딩 중, false = 미로그인, object = 로그인 정보
  const [auth, setAuth] = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);

  useEffect(() => {
    request("/auth/me")
      .then((data) => setAuth(data))
      .catch(() => setAuth(false));
  }, []);

  function handleLogin(data) {
    // 토큰은 서버가 httpOnly 쿠키로 관리 — 클라이언트는 사용자 정보만 저장
    setAuth({ username: data.username, role: data.role });
  }

  async function handleLogout() {
    try { await request("/auth/logout", { method: "POST" }); } catch {}
    setAuth(false);
  }

  if (auth === null) {
    return <div className="login-wrap"><p style={{ color: "#667085" }}>로딩 중...</p></div>;
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <h1>교육청 인사 발령 관리</h1>
          <p>{auth.role === "admin" ? "비정형 인사 발령 텍스트를 정형 데이터로 변환하고 검수해 저장합니다." : "인사 발령 데이터를 검색하고 조회합니다."}</p>
        </div>
        <div className="header-user">
          <span className="user-info">
            {auth.username}
            <span className={`badge ${auth.role === "admin" ? "ok" : "role-user"}`}>
              {auth.role === "admin" ? "관리자" : "사용자"}
            </span>
          </span>
          {auth.role === "admin" && (
            <button className="secondary" onClick={() => setShowPwModal(true)}>비밀번호 변경</button>
          )}
          <button className="secondary" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>
      {auth.role === "admin" ? <AdminView /> : <UserView />}
      {showPwModal && (
        <ChangePasswordModal
          onClose={() => setShowPwModal(false)}
          onLogout={handleLogout}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
