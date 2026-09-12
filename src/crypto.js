import { PUBLIC_KEY_PEM, enc, dec, normalizeProduct } from "./config.js";

function base64ToBytes(value) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function base64UrlToBytes(value) {
  let s = String(value).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return base64ToBytes(s);
}
function bytesToBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function pemBodyToBytes(pem, label) {
  return base64ToBytes(String(pem)
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s+/g, ""));
}

export async function parseAndVerifyLicense(key) {
  try {
    const parts = String(key ?? "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "ZYV1")
      return { ok: false, payload: null, error: "Invalid Zyven key format." };
    const payloadBytes = base64UrlToBytes(parts[1]);
    const signature = base64UrlToBytes(parts[2]);
    const publicKey = await crypto.subtle.importKey(
      "spki", pemBodyToBytes(PUBLIC_KEY_PEM, "PUBLIC KEY"),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, payloadBytes)))
      return { ok: false, payload: null, error: "Invalid signature." };
    const payload = JSON.parse(dec.decode(payloadBytes));
    const product = normalizeProduct(payload?.Product, false);
    if (!product) return { ok: false, payload: null, error: "Unsupported product." };
    payload.Product = product;
    if (Number(payload.Version) < 1 || Number(payload.Version) > 2)
      return { ok: false, payload: null, error: "Unsupported license version." };
    return { ok: true, payload, error: "" };
  } catch (e) {
    return { ok: false, payload: null, error: String(e?.message ?? e) };
  }
}

export async function signLicensePayload(payload, privatePemB64) {
  const pemText = dec.decode(base64ToBytes(String(privatePemB64).trim()));
  const key = await crypto.subtle.importKey(
    "pkcs8", pemBodyToBytes(pemText, "PRIVATE KEY"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const bytes = enc.encode(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, bytes));
  return `ZYV1.${bytesToBase64Url(bytes)}.${bytesToBase64Url(sig)}`;
}

export async function fingerprintKey(key) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(key ?? "").trim())));
  return Array.from(hash.slice(0, 8), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function hmac(secret, payload) {
  if (!secret) throw new Error("ZYVEN_ADMIN_KEY secret is missing.");
  const key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSessionToken(env, product, id, device, version) {
  const payload = `${String(product).toUpperCase()}|${String(id).toUpperCase()}|${String(device).toUpperCase()}|${version}`;
  return `ZYS1.${version}.${bytesToBase64Url(await hmac(env.ZYVEN_ADMIN_KEY, payload))}`;
}

export async function validateSessionToken(env, token, product, id, device, expectedVersion) {
  if (!env.ZYVEN_ADMIN_KEY) return false;
  const parts = String(token ?? "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ZYS1") return false;
  const version = Number(parts[1]);
  if (!Number.isSafeInteger(version) || version < 0 || version !== Number(expectedVersion)) return false;
  let supplied;
  try { supplied = base64UrlToBytes(parts[2]); } catch { return false; }
  const payload = `${String(product ?? "").trim().toUpperCase()}|${String(id ?? "").trim().toUpperCase()}|${String(device ?? "").trim().toUpperCase()}|${version}`;
  return constantTimeEqual(supplied, await hmac(env.ZYVEN_ADMIN_KEY, payload));
}

export function readSessionVersion(token) {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ZYS1") return null;
  const version = Number(parts[1]);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

export function isAdmin(request, env) {
  const supplied = request.headers.get("X-Zyven-Admin-Key") ?? "";
  const expected = String(env.ZYVEN_ADMIN_KEY ?? "");
  if (!expected || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
