export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function badRequest(message, details) {
  return json(400, { error: message, details });
}

export function unauthorized(message="Unauthorized") {
  return json(401, { error: message }, { "WWW-Authenticate": "Bearer" });
}

export function notFound(message="Not Found") {
  return json(404, { error: message });
}

export function methodNotAllowed() {
  return json(405, { error: "Method Not Allowed" });
}

export function getQuery(event) {
  const u = new URL(event.rawUrl);
  return Object.fromEntries(u.searchParams.entries());
}

export function getRiyadhDate(override) {
  if (override) return override;
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

export async function readJson(event) {
  if (!event.body) return {};
  const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body;
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}

export function normStr(v) {
  return String(v ?? "").trim();
}

export function normLower(v) {
  return normStr(v).toLowerCase();
}

export function safeNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
