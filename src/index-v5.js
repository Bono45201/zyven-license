import {
  SERVER_VERSION, SUPPORTED_PRODUCTS, DEFAULT_PRODUCT,
  getPublicUrl, readJson, json, textJson, unixNow, normalizeProduct
} from "./config.js";
import {
  isAdmin, createSessionToken, validateSessionToken, readSessionVersion
} from "./crypto.js";
import { validateLicense, getLicense } from "./db.js";
import {
  adminList, adminDeleted, adminImport, adminCreate, adminSetStatus,
  adminDelete, adminLogoutOne, adminLogoutAll, adminResetDevice, adminSetExpiry
} from "./admin.js";

function customerMeta(row, now = unixNow()) {
  if (!row) return {
    expiresUtc: 0,
    expiryMode: "UNKNOWN",
    serverNowUtc: now
  };

  const expiresUtc = Number(row.expires_utc ?? 0);
  return {
    expiresUtc,
    expiryMode: expiresUtc > 0 ? "DATE" : "LIFETIME",
    plan: String(row.plan ?? ""),
    deviceId: String(row.device_id ?? ""),
    createdUtc: Number(row.created_utc ?? 0),
    lastSeenUtc: Number(row.last_seen_utc ?? 0),
    serverNowUtc: now
  };
}

export default {
  async fetch(request, env) {
    try {
      if (!env.DB) return textJson("D1 binding DB is missing.", 500);
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      if (method === "GET" && path === "/health") {
        return json({
          ok: true,
          service: "Zyven License Server",
          version: SERVER_VERSION,
          products: [...SUPPORTED_PRODUCTS],
          defaultProduct: DEFAULT_PRODUCT,
          sessionMode: "single-live-session",
          publicUrl: getPublicUrl(request, env)
        });
      }
      if (method === "GET" && path === "/") return new Response("Zyven License Server");
      if (method === "POST" && path === "/api/license/login") return await login(request, env);
      if (method === "POST" && path === "/api/license/check") return await check(request, env);
      if (method === "POST" && path === "/api/license/logout") return await logout(request, env);

      if (path.startsWith("/api/admin/")) {
        if (!isAdmin(request, env)) return new Response(null, { status: 401 });
        if (method === "GET" && path === "/api/admin/licenses") return await adminList(request, env);
        if (method === "GET" && path === "/api/admin/deleted") return await adminDeleted(request, env);
        if (method === "POST" && path === "/api/admin/import") return await adminImport(request, env);
        if (method === "POST" && path === "/api/admin/create") return await adminCreate(request, env);
        if (method === "POST" && path === "/api/admin/logout-all") return await adminLogoutAll(request, env);

        let m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/status$/);
        if (method === "POST" && m) return await adminSetStatus(request, env, decodeURIComponent(m[1]));
        m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/logout$/);
        if (method === "POST" && m) return await adminLogoutOne(env, decodeURIComponent(m[1]));
        m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/reset-device$/);
        if (method === "POST" && m) return await adminResetDevice(env, decodeURIComponent(m[1]));
        m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/expiry$/);
        if (method === "POST" && m) return await adminSetExpiry(request, env, decodeURIComponent(m[1]));
        m = path.match(/^\/api\/admin\/licenses\/([^/]+)$/);
        if (method === "DELETE" && m) return await adminDelete(env, decodeURIComponent(m[1]));
      }

      return textJson("Not found.", 404);
    } catch (error) {
      console.error(error);
      return textJson(String(error?.message ?? "License server error."), 500);
    }
  }
};

async function login(request, env) {
  const body = await readJson(request);
  const v = await validateLicense(env, body?.licenseKey, body?.deviceId, body?.product);
  const now = unixNow();

  if (!v.allowed || !v.row) {
    return json({
      allowed: false,
      status: v.status,
      message: v.message,
      product: v.product || "",
      sessionToken: "",
      ...customerMeta(v.row, now)
    });
  }

  await env.DB.prepare(`
    UPDATE licenses
    SET session_version=session_version+1, session_last_seen_utc=?, last_seen_utc=?
    WHERE license_id=?
  `).bind(now, now, v.row.license_id).run();

  const row = await getLicense(env, v.row.license_id);
  const token = await createSessionToken(env, row.product, row.license_id, v.deviceId, Number(row.session_version));
  return json({
    allowed: true,
    status: "ACTIVE",
    message: "License active.",
    product: row.product,
    licenseId: row.license_id,
    sessionToken: token,
    ...customerMeta(row, now)
  });
}

async function check(request, env) {
  const body = await readJson(request);
  const v = await validateLicense(env, body?.licenseKey, body?.deviceId, body?.product);
  const now = unixNow();

  if (!v.allowed || !v.row) {
    return json({
      allowed: false,
      status: v.status,
      message: v.message,
      product: v.product || "",
      ...customerMeta(v.row, now)
    });
  }

  const token = String(body?.sessionToken ?? "").trim();
  const ok = await validateSessionToken(env, token, v.row.product, v.row.license_id, v.deviceId, Number(v.row.session_version));
  if (!ok) {
    return json({
      allowed: false,
      status: "SESSION_EXPIRED",
      message: "Your Zyven session ended. Sign in again.",
      product: v.row.product,
      ...customerMeta(v.row, now)
    });
  }

  await env.DB.prepare(`
    UPDATE licenses
    SET session_last_seen_utc=?,
        last_seen_utc=CASE WHEN (? - last_seen_utc)>=60 THEN ? ELSE last_seen_utc END
    WHERE license_id=?
  `).bind(now, now, now, v.row.license_id).run();

  const row = await getLicense(env, v.row.license_id);
  return json({
    allowed: true,
    status: "ACTIVE",
    message: "License active.",
    product: row.product,
    licenseId: row.license_id,
    ...customerMeta(row, now)
  });
}

async function logout(request, env) {
  const body = await readJson(request);
  const id = String(body?.licenseId ?? "").trim();
  const device = String(body?.deviceId ?? "").trim().toUpperCase();
  const product = normalizeProduct(body?.product, false);
  const token = String(body?.sessionToken ?? "").trim();
  const version = readSessionVersion(token);
  if (!id || !device || !product || version === null) return json({ ok: true, removed: 0 });

  const row = await getLicense(env, id);
  if (!row || normalizeProduct(row.product, false) !== product) return json({ ok: true, removed: 0 });
  const signatureOk = await validateSessionToken(env, token, product, id, device, version);
  if (!signatureOk || Number(row.session_version) !== version) return json({ ok: true, removed: 0 });

  await env.DB.prepare(`UPDATE licenses SET session_version=session_version+1, session_last_seen_utc=0 WHERE license_id=?`).bind(id).run();
  return json({ ok: true, removed: 1 });
}
