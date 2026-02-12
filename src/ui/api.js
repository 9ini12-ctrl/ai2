import { toast } from "./toast.js";

export const session = {
  get token(){ return localStorage.getItem("admin_jwt") || ""; },
  set token(v){ localStorage.setItem("admin_jwt", v || ""); },
  clear(){ localStorage.removeItem("admin_jwt"); }
};

export function qs(obj){
  const sp = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function apiGet(path, params){
  return apiFetch(path + qs(params), { method:"GET" });
}

export async function apiFetch(path, options = {}){
  const headers = new Headers(options.headers || {});
  headers.set("Accept","application/json");
  if (!(options.body instanceof FormData) && !headers.has("Content-Type") && options.body !== undefined){
    headers.set("Content-Type","application/json");
  }
  if (path.startsWith("/api/admin")){
    const t = session.token;
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(path, { ...options, headers });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!res.ok){
    const msg = data?.error || data?.message || `خطأ (${res.status})`;
    toast("حدث خطأ", msg);
    throw new Error(msg);
  }
  return data;
}
