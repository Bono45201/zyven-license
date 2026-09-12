export const SERVER_VERSION = "5.0.3-cf1";
export const ACTIVE_SESSION_SECONDS = 45;
export const DEFAULT_PRODUCT = "ZYVEN-SOUND-TOOL";
export const SUPPORTED_PRODUCTS = new Set(["ZYVEN-SOUND-TOOL", "ZYVEN-GP-TOOL"]);

export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvaUZkM2Bo8MIq84qGZs5
lVx1PpU46GLtwI4nc0UfikVSRFZ6nT1U1MGsG4hEx+MqDJcK52rI9OR7RCvIIqL5
bUVEB7WWO38eyIsW3FOy0nDL3J+n2YPpJJx6Cvex27yd8Jjl6OBZe6z+jClsJ07Z
6LktPVUENrmkM+IYHuHZOs0Qw7TQuvkCzGKFZfOvZM4e39lzRUZnjIBhH9UoiRrf
fJ357iy1+OjO39wj+h7rzFLiqaqnkJm14GX2C0kWn4CgQV00ywNKapQS1+NnM3zr
lcljVB+xykWjWyIiDQJC2oenl8ewifY5av4F0tKY57OMzzkyf2IX8zgCMDqJLRvf
8wIDAQAB
-----END PUBLIC KEY-----`;

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
