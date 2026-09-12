export const SERVER_VERSION = "5.0.2-cf1";
export const ACTIVE_SESSION_SECONDS = 45;
export const DEFAULT_PRODUCT = "ZYVEN-SOUND-TOOL";
export const SUPPORTED_PRODUCTS = new Set(["ZYVEN-SOUND-TOOL", "ZYVEN-GP-TOOL"]);

export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA1IH4rHG8nJY3IC5pwigb
gPWP/TppiQ+ZaglOdyiqNjB6oDEPJ4ebOHzVuw9LXP75pF0MlLkaLqSBOnrcQVLO
l6/wuED8n42Miu6vBhemzX6G3N6oC4bFKUWnrC6b5ZITgOSPwWZnQUTFgsRcp+dn
hJteIPm4kFEWmfxhqw+VxekOQzJgeKa9vnoP3uT+FLvprBk7TYPg2LELjJntocCB
sLHF0+xrrXj+CXNpiSbAOR4UHfGUaPwNr1v8PgyXyIes3nZOTAyz+czS/2wRKZVe
6FZ9M6xU1+P3P0K4eh3L7AREzQBl9g295G6tVLGsXimPZv5xBgYIUp8HyzMA3W5/
CV/RBPJ1xoQzXW75L5QfUu0lkkd4VomNjSFw2+sDdrrNZ7PqUjfsn7gb57DI7Ltc
IU4pB2dEOqy+YsypcnTQVZ6L4o1/JvGXxZuh7ZQuKGU4KvCaf5FXJtXaFpWd/38k
2e0us7bTTWGtDChkDeBzf5IKDKJPg3ma9xs62MbhdWtvAgMBAAE=
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
