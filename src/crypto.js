import { enc } from "./config.js";

function bytesToBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value) {
  let s = String(value ?? "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createOpaqueLicenseKey(licenseId) {
  const id = String(licenseId ?? "").trim().toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(id)) throw new Error("Invalid license ID.");
  const secret = crypto.getRandomValues(new Uint8Array(32));
  return `ZYV2.${id}.${bytesToBase64Url(secret)}`;
}

export function parseOpaqueLicenseKey(key) {
  try {
    const parts = String(key ?? "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "ZYV2")
      return { ok: false, licenseId: "", error: "Invalid Zyven license key format." };
    const id = String(parts[1] ?? "").trim().toUpperCase();
    if (!/^[A-F0-9]{32}$/.test(id))
      return { ok: false, licenseId: "", error: "Invalid Zyven license ID." };
    const secret = base64UrlToBytes(parts[2]);
    if (secret.length !== 32)
      return { ok: false, licenseId: "", error: "Invalid Zyven license secret." };
    return { ok: true, licenseId: id, error: "" };
  } catch {
    return { ok: false, licenseId: "", error: "Invalid Zyven license key format." };
  }
}

export async function fingerprintKey(key) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(key ?? "").trim())));
  return Array.from(hash, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
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
