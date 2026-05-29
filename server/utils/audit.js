export function auditLog(event, { username, ip, detail } = {}) {
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    event,
    username: username || "anonymous",
    ip: ip || "-",
    detail,
  }));
}
