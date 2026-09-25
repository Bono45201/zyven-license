export const SERVER_VERSION = "5.2.0-cf1";
export const ACTIVE_SESSION_SECONDS = 45;
export const DEFAULT_PRODUCT = "ZYVEN-SOUND-TOOL";
export const SUPPORTED_PRODUCTS = new Set(["ZYVEN-SOUND-TOOL", "ZYVEN-GP-TOOL"]);

export const enc = new TextEncoder();
export const dec = new TextDecoder();

export function normalizeProduct(raw, useDefault = false) {
  const value = String(raw ?? "").trim().toUpperCase();
  const product = value || (useDefault ? DEFAULT_PRODUCT : "");
  return SUPPORTED_PRODUCTS.has(product) ? product : null;
}

export function productFromQuery(request) {
  const raw = String(new URL(request.url).searchParams.get("product") ?? "").trim();
  return raw ? normalizeProduct(raw, false) : "";
}

export function normalizeDevice(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value || value === "AUTO") return "AUTO";
  if (value === "*") return "*";
  if (value.length < 8 || value.length > 64) return null;
  return /^[A-Z0-9_-]+$/.test(value) ? value : null;
}

export function parseExpiry(raw) {
  const text = String(raw ?? "LIFETIME").trim();
  if (!text || text.toUpperCase() === "LIFETIME") return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d, 23, 59, 59);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return Math.floor(ms / 1000);
}

export function getPublicUrl(request, env) {
  const configured = String(env.ZYVEN_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash)
        return u.origin + u.pathname.replace(/\/+$/, "");
    } catch {}
  }
  return new URL(request.url).origin;
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export function unixNow() { return Math.floor(Date.now() / 1000); }

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export function textJson(message, status) {
  return new Response(JSON.stringify(String(message ?? "")), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
