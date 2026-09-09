const PRODUCT_ID = "ZYVEN-GP-STUDIO";
const SERVER_VERSION = "4.3.0-cf1";
const ACTIVE_SESSION_SECONDS = 45;

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAsIdjYg7xphp/BU1n2ebF
aApMnpNqx1OTeWnbInTt2s0flzKifjtWyk/ynRUUnqxJ64PpES0Nz6KcvGiF9jpo
40FbjR1MM4yY2bswpvALhULcRp7Ji2T5TzpN3P+ZfqFN9jsrNpz4VEw10evWdCOO
k/h3RMAdvzGsLjkRTMt4cEE04L4bpXwiOQVM5wIWZ+j60cFbd5o7kbspJ0sPa0sF
gz1+bRQBlvdqAnf5A5xPH9YhNw8ed/ayWR9fAfjwb6FRAe1emOeQHknR8s4AUU/E
3rRLMuqAiKFb9OpliZ4brZA/vXVagPzPWLeyLpFNHIU4oxYm2DFRrdQTSo0YzUF/
jIJWF0WglsVusuR9jzuaDjApogf4TcLRiLY+kpeTMG/zhrUyLRGIRjIvswmJZsez
+gaJZpbKEoloWLx/fePMD/zcnqNiBnin7AJN4DR45EVYJgJOasU2jmEMLDAEYsOa
nzuV27ou1ET9i1h5zZb5ZHrINeQw+GHo7MmLk74Hs3GPAgMBAAE=
-----END PUBLIC KEY-----`;

const enc = new TextEncoder();
const dec = new TextDecoder();

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
          product: PRODUCT_ID,
          version: SERVER_VERSION,
          sessionMode: "single-live-session",
          publicUrl: getPublicUrl(request, env),
          localTest: false
        });
      }

      if (method === "GET" && path === "/") {
        return new Response("Zyven License Server", {
          headers: { "content-type": "text/plain; charset=utf-8" }
        });
      }

      if (method === "POST" && path === "/api/license/login")
        return await login(request, env);

      if (method === "POST" && path === "/api/license/check")
        return await check(request, env);

      if (method === "POST" && path === "/api/license/logout")
        return await logout(request, env);

      if (path.startsWith("/api/admin/")) {
        if (!isAdmin(request, env)) return new Response(null, { status: 401 });

        if (method === "GET" && path === "/api/admin/licenses")
          return await adminList(env);

        if (method === "GET" && path === "/api/admin/deleted")
          return await adminDeleted(env);

        if (method === "POST" && path === "/api/admin/import")
          return await adminImport(request, env);

        if (method === "POST" && path === "/api/admin/create")
          return await adminCreate(request, env);

        if (method === "POST" && path === "/api/admin/logout-all")
          return await adminLogoutAll(env);

        let m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/status$/);
        if (method === "POST" && m)
          return await adminSetStatus(request, env, decodeURIComponent(m[1]));

        m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/logout$/);
        if (method === "POST" && m)
          return await adminLogoutOne(env, decodeURIComponent(m[1]));

        m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/reset-device$/);
        if (method === "POST" && m)
          return await adminResetDevice(env, decodeURIComponent(m[1]));

        m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/expiry$/);
        if (method === "POST" && m)
          return await adminSetExpiry(request, env, decodeURIComponent(m[1]));

        m = path.match(/^\/api\/admin\/licenses\/([^/]+)$/);
        if (method === "DELETE" && m)
          return await adminDelete(env, decodeURIComponent(m[1]));
      }

      return textJson("Not found.", 404);
    } catch (error) {
      console.error(error);
      return textJson("License server error.", 500);
    }
  }
};

async function login(request, env) {
  const body = await readJson(request);
  const validation = await validateLicense(env, body?.licenseKey, body?.deviceId);
  if (!validation.allowed || !validation.row)
    return json({
      allowed: false,
      status: validation.status,
      message: validation.message,
      sessionToken: ""
    });

  const now = unixNow();
  await env.DB.prepare(`
    UPDATE licenses
    SET session_version = session_version + 1,
        session_last_seen_utc = ?,
        last_seen_utc = ?
    WHERE license_id = ?
  `).bind(now, now, validation.row.license_id).run();

  const row = await getLicense(env, validation.row.license_id);
  if (!row)
    return json({ allowed: false, status: "UNREGISTERED", message: "This license is not registered on the Zyven server.", sessionToken: "" });

  const token = await createSessionToken(env, row.license_id, validation.deviceId, Number(row.session_version));
  return json({ allowed: true, status: "ACTIVE", message: "License active.", sessionToken: token });
}

async function check(request, env) {
  const body = await readJson(request);
  const validation = await validateLicense(env, body?.licenseKey, body?.deviceId);
  if (!validation.allowed || !validation.row)
    return json({ allowed: false, status: validation.status, message: validation.message });

  const token = String(body?.sessionToken ?? "").trim();
  const ok = await validateSessionToken(
    env,
    token,
    validation.row.license_id,
    validation.deviceId,
    Number(validation.row.session_version)
  );

  if (!ok)
    return json({ allowed: false, status: "SESSION_EXPIRED", message: "Your Zyven session ended. Sign in again." });

  const now = unixNow();
  await env.DB.prepare(`
    UPDATE licenses
    SET session_last_seen_utc = ?,
        last_seen_utc = CASE WHEN (? - last_seen_utc) >= 60 THEN ? ELSE last_seen_utc END
    WHERE license_id = ?
  `).bind(now, now, now, validation.row.license_id).run();

  return json({ allowed: true, status: "ACTIVE", message: "License active." });
}

async function logout(request, env) {
  const body = await readJson(request);
  const licenseId = String(body?.licenseId ?? "").trim();
  const deviceId = String(body?.deviceId ?? "").trim().toUpperCase();
  const token = String(body?.sessionToken ?? "").trim();
  const version = readSessionVersion(token);

  if (!licenseId || !deviceId || version === null)
    return json({ ok: true, removed: 0 });

  const row = await getLicense(env, licenseId);
  if (!row) return json({ ok: true, removed: 0 });

  const signatureOk = await validateSessionToken(env, token, licenseId, deviceId, version);
  if (!signatureOk || Number(row.session_version) !== version)
    return json({ ok: true, removed: 0 });

  await env.DB.prepare(`
    UPDATE licenses
    SET session_version = session_version + 1,
        session_last_seen_utc = 0
    WHERE license_id = ?
  `).bind(licenseId).run();

  return json({ ok: true, removed: 1 });
}

async function adminList(env) {
  const now = unixNow();
  const rows = await env.DB.prepare(`
    SELECT license_id, fingerprint, customer, role, plan, device_id, status,
           expires_utc, created_utc, last_seen_utc, session_last_seen_utc
    FROM licenses
    ORDER BY created_utc DESC
  `).all();

  return json((rows.results ?? []).map(r => ({
    LicenseId: r.license_id,
    Fingerprint: r.fingerprint,
    Customer: r.customer,
    Role: r.role,
    Plan: r.plan,
    DeviceId: r.device_id,
    Status: r.status,
    ExpiresUtc: Number(r.expires_utc ?? 0),
    CreatedUtc: Number(r.created_utc ?? 0),
    LastSeenUtc: Number(r.last_seen_utc ?? 0),
    ActiveSessions: Number(r.session_last_seen_utc ?? 0) >= now - ACTIVE_SESSION_SECONDS ? 1 : 0
  })));
}

async function adminDeleted(env) {
  const rows = await env.DB.prepare(`
    SELECT license_id, fingerprint, customer, deleted_utc
    FROM deleted_licenses
    ORDER BY deleted_utc DESC
  `).all();

  return json((rows.results ?? []).map(r => ({
    LicenseId: r.license_id,
    Fingerprint: r.fingerprint,
    Customer: r.customer,
    DeletedUtc: Number(r.deleted_utc ?? 0)
  })));
}

async function adminImport(request, env) {
  const body = await readJson(request);
  const key = String(body?.licenseKey ?? "").trim();
  const parsed = await parseAndVerifyLicense(key);
  if (!parsed.ok || !parsed.payload) return textJson(parsed.error, 400);

  const p = parsed.payload;
  if (Number(p.Version) !== 2)
    return textJson("Only server-managed v2 CUSTOMER keys can be imported here.", 400);
  if (String(p.Role ?? "").toUpperCase() !== "CUSTOMER")
    return textJson("OWNER keys are private/offline and are never registered as customer licenses.", 400);

  const fingerprint = await fingerprintKey(key);
  const result = await registerPayload(env, p, fingerprint);
  if (!result.ok) return textJson(result.error, 400);
  return json(toAdminRecord(result.row, 0));
}

async function adminCreate(request, env) {
  if (!env.ZYVEN_PRIVATE_KEY_PEM_B64)
    return textJson("Private signing key is missing on the license server.", 400);

  const body = await readJson(request);
  const expiry = parseExpiry(body?.expiry);
  if (expiry === null) return textJson("Expiry must be LIFETIME or yyyy-MM-dd.", 400);

  let customer = String(body?.customer ?? "").trim();
  if (customer.length > 80) return textJson("Customer name is too long.", 400);
  let plan = String(body?.plan ?? "").trim();
  if (plan.length > 40) return textJson("Plan name is too long.", 400);

  const deviceId = normalizeDevice(body?.deviceId);
  if (deviceId === null)
    return textJson("Device ID must be AUTO, *, or a valid Zyven device ID.", 400);

  const now = unixNow();
  const payload = {
    Version: 2,
    Product: PRODUCT_ID,
    Customer: customer || "Zyven User",
    Role: "CUSTOMER",
    Plan: plan || "Lifetime",
    DeviceId: deviceId,
    LicenseId: crypto.randomUUID().replaceAll("-", "").toUpperCase(),
    IssuedUtc: now,
    ExpiresUtc: expiry,
    ServerUrl: getPublicUrl(request, env)
  };

  const key = await signLicensePayload(payload, env.ZYVEN_PRIVATE_KEY_PEM_B64);
  const fingerprint = await fingerprintKey(key);
  const result = await registerPayload(env, payload, fingerprint);
  if (!result.ok || !result.row) return textJson(result.error || "Could not register license.", 400);

  return json({
    licenseKey: key,
    record: toAdminRecord(result.row, 0)
  });
}

async function adminSetStatus(request, env, id) {
  const body = await readJson(request);
  const status = String(body?.status ?? "").trim().toUpperCase();
  if (!["ACTIVE", "PAUSED", "REVOKED"].includes(status))
    return textJson("Status must be ACTIVE, PAUSED or REVOKED.", 400);

  const current = await getLicense(env, id);
  if (!current) return new Response(null, { status: 404 });

  if (status === "PAUSED" || status === "REVOKED") {
    await env.DB.prepare(`
      UPDATE licenses
      SET status = ?, session_version = session_version + 1, session_last_seen_utc = 0
      WHERE license_id = ?
    `).bind(status, id).run();
  } else {
    await env.DB.prepare(`UPDATE licenses SET status = ? WHERE license_id = ?`).bind(status, id).run();
  }

  const row = await getLicense(env, id);
  return json(toAdminRecord(row, 0));
}

async function adminDelete(env, id) {
  const row = await getLicense(env, id);
  if (!row) return new Response(null, { status: 404 });

  const now = unixNow();
  const active = Number(row.session_last_seen_utc ?? 0) >= now - ACTIVE_SESSION_SECONDS ? 1 : 0;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO deleted_licenses (license_id, fingerprint, customer, deleted_utc)
    VALUES (?, ?, ?, ?)
  `).bind(row.license_id, row.fingerprint, row.customer, now).run();

  await env.DB.prepare(`DELETE FROM licenses WHERE license_id = ?`).bind(id).run();

  return json({
    ok: true,
    removedSessions: active,
    deletedLicenseId: row.license_id,
    customer: row.customer
  });
}

async function adminLogoutOne(env, id) {
  const row = await getLicense(env, id);
  if (!row) return new Response(null, { status: 404 });

  const now = unixNow();
  const removed = Number(row.session_last_seen_utc ?? 0) >= now - ACTIVE_SESSION_SECONDS ? 1 : 0;

  await env.DB.prepare(`
    UPDATE licenses
    SET session_version = session_version + 1,
        session_last_seen_utc = 0
    WHERE license_id = ?
  `).bind(id).run();

  return json({ ok: true, removed, invalidated: 1 });
}

async function adminLogoutAll(env) {
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM licenses`).first();
  const activeRow = await env.DB.prepare(`
    SELECT COUNT(*) AS c FROM licenses WHERE session_last_seen_utc >= ?
  `).bind(unixNow() - ACTIVE_SESSION_SECONDS).first();

  await env.DB.prepare(`
    UPDATE licenses
    SET session_version = session_version + 1,
        session_last_seen_utc = 0
  `).run();

  return json({
    ok: true,
    removed: Number(activeRow?.c ?? 0),
    invalidated: Number(countRow?.c ?? 0)
  });
}

async function adminResetDevice(env, id) {
  const row = await getLicense(env, id);
  if (!row) return new Response(null, { status: 404 });

  await env.DB.prepare(`
    UPDATE licenses
    SET device_id = 'AUTO',
        session_version = session_version + 1,
        session_last_seen_utc = 0
    WHERE license_id = ?
  `).bind(id).run();

  return json(toAdminRecord(await getLicense(env, id), 0));
}

async function adminSetExpiry(request, env, id) {
  const body = await readJson(request);
  const expiry = parseExpiry(body?.expiry);
  if (expiry === null) return textJson("Expiry must be LIFETIME or yyyy-MM-dd.", 400);

  const row = await getLicense(env, id);
  if (!row) return new Response(null, { status: 404 });

  const now = unixNow();
  if (expiry > 0 && now > expiry) {
    await env.DB.prepare(`
      UPDATE licenses
      SET expires_utc = ?,
          session_version = session_version + 1,
          session_last_seen_utc = 0
      WHERE license_id = ?
    `).bind(expiry, id).run();
  } else {
    await env.DB.prepare(`UPDATE licenses SET expires_utc = ? WHERE license_id = ?`).bind(expiry, id).run();
  }

  return json(toAdminRecord(await getLicense(env, id), 0));
}

async function validateLicense(env, licenseKey, requestedDeviceId) {
  const key = String(licenseKey ?? "").trim();
  const parsed = await parseAndVerifyLicense(key);
  if (!parsed.ok || !parsed.payload)
    return { allowed: false, status: "INVALID", message: parsed.error, row: null, deviceId: "" };

  const p = parsed.payload;
  if (Number(p.Version) !== 2)
    return { allowed: false, status: "UNSUPPORTED", message: "This server accepts server-managed v2 customer licenses only.", row: null, deviceId: "" };

  const licenseId = String(p.LicenseId ?? "").trim();
  if (!licenseId)
    return { allowed: false, status: "INVALID", message: "License ID is missing.", row: null, deviceId: "" };

  const deviceId = String(requestedDeviceId ?? "").trim().toUpperCase();
  if (!deviceId)
    return { allowed: false, status: "DEVICE", message: "Device ID is missing.", row: null, deviceId: "" };

  const fingerprint = await fingerprintKey(key);

  const deleted = await env.DB.prepare(`
    SELECT license_id FROM deleted_licenses
    WHERE license_id = ? COLLATE NOCASE OR fingerprint = ? COLLATE NOCASE
    LIMIT 1
  `).bind(licenseId, fingerprint).first();

  if (deleted)
    return { allowed: false, status: "DELETED", message: "This license was permanently deleted by Zyven.", row: null, deviceId };

  let row = await getLicense(env, licenseId);
  if (!row)
    return { allowed: false, status: "UNREGISTERED", message: "This license is not registered on the Zyven server.", row: null, deviceId };

  if (String(row.fingerprint).toUpperCase() !== fingerprint.toUpperCase())
    return { allowed: false, status: "INVALID", message: "This license does not match the registered key.", row, deviceId };

  const status = String(row.status ?? "").toUpperCase();
  if (status === "REVOKED")
    return { allowed: false, status: "REVOKED", message: "This license has been revoked by Zyven.", row, deviceId };
  if (status === "PAUSED")
    return { allowed: false, status: "PAUSED", message: "This license is temporarily paused.", row, deviceId };

  const now = unixNow();
  if (Number(row.expires_utc ?? 0) > 0 && now > Number(row.expires_utc))
    return { allowed: false, status: "EXPIRED", message: "This license has expired.", row, deviceId };

  const storedDevice = String(row.device_id ?? "AUTO").toUpperCase();
  if (storedDevice === "AUTO") {
    await env.DB.prepare(`UPDATE licenses SET device_id = ? WHERE license_id = ?`).bind(deviceId, licenseId).run();
    row = await getLicense(env, licenseId);
  } else if (storedDevice !== "*" && storedDevice !== deviceId) {
    return { allowed: false, status: "DEVICE", message: "This license is locked to another PC.", row, deviceId };
  }

  return { allowed: true, status: "ACTIVE", message: "License active.", row, deviceId };
}

async function registerPayload(env, p, fingerprint) {
  const licenseId = String(p.LicenseId ?? "").trim();
  if (!licenseId) return { ok: false, row: null, error: "License ID is missing." };

  const deleted = await env.DB.prepare(`
    SELECT license_id FROM deleted_licenses
    WHERE license_id = ? COLLATE NOCASE OR fingerprint = ? COLLATE NOCASE
    LIMIT 1
  `).bind(licenseId, fingerprint).first();

  if (deleted)
    return { ok: false, row: null, error: "That exact signed key was permanently deleted and cannot be re-imported. Create a new key instead." };

  const byId = await getLicense(env, licenseId);
  if (byId) {
    if (String(byId.fingerprint).toUpperCase() !== fingerprint.toUpperCase())
      return { ok: false, row: null, error: "A different signed key already uses this License ID." };
    return { ok: true, row: byId, error: "" };
  }

  const byFingerprint = await env.DB.prepare(`
    SELECT license_id FROM licenses WHERE fingerprint = ? COLLATE NOCASE LIMIT 1
  `).bind(fingerprint).first();

  if (byFingerprint)
    return { ok: false, row: null, error: "This key fingerprint is already registered under another License ID." };

  const now = unixNow();
  await env.DB.prepare(`
    INSERT INTO licenses (
      license_id, fingerprint, customer, role, plan, device_id, status,
      expires_utc, created_utc, last_seen_utc, session_version, session_last_seen_utc
    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 0, 0, 0)
  `).bind(
    licenseId,
    fingerprint,
    String(p.Customer ?? "").trim() || "Zyven User",
    String(p.Role ?? "").trim().toUpperCase() || "CUSTOMER",
    String(p.Plan ?? "").trim() || "Lifetime",
    String(p.DeviceId ?? "").trim().toUpperCase() || "AUTO",
    Number(p.ExpiresUtc ?? 0),
    now
  ).run();

  return { ok: true, row: await getLicense(env, licenseId), error: "" };
}

async function getLicense(env, id) {
  return await env.DB.prepare(`
    SELECT license_id, fingerprint, customer, role, plan, device_id, status,
           expires_utc, created_utc, last_seen_utc, session_version, session_last_seen_utc
    FROM licenses
    WHERE license_id = ? COLLATE NOCASE
    LIMIT 1
  `).bind(String(id ?? "").trim()).first();
}

function toAdminRecord(row, activeSessions) {
  if (!row) return null;
  return {
    LicenseId: row.license_id,
    Fingerprint: row.fingerprint,
    Customer: row.customer,
    Role: row.role,
    Plan: row.plan,
    DeviceId: row.device_id,
    Status: row.status,
    ExpiresUtc: Number(row.expires_utc ?? 0),
    CreatedUtc: Number(row.created_utc ?? 0),
    LastSeenUtc: Number(row.last_seen_utc ?? 0),
    ActiveSessions: Number(activeSessions ?? 0)
  };
}

async function parseAndVerifyLicense(key) {
  try {
    const parts = String(key ?? "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "ZYV1")
      return { ok: false, payload: null, error: "Invalid Zyven key format." };

    const payloadBytes = base64UrlToBytes(parts[1]);
    const signature = base64UrlToBytes(parts[2]);
    const publicKey = await crypto.subtle.importKey(
      "spki",
      pemBodyToBytes(PUBLIC_KEY_PEM, "PUBLIC KEY"),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      payloadBytes
    );
    if (!valid) return { ok: false, payload: null, error: "Invalid signature." };

    const payload = JSON.parse(dec.decode(payloadBytes));
    if (!payload || payload.Product !== PRODUCT_ID)
      return { ok: false, payload: null, error: "Wrong product." };
    if (Number(payload.Version) < 1 || Number(payload.Version) > 2)
      return { ok: false, payload: null, error: "Unsupported license version." };

    return { ok: true, payload, error: "" };
  } catch (e) {
    return { ok: false, payload: null, error: String(e?.message ?? e) };
  }
}

async function signLicensePayload(payload, privatePemB64) {
  const pemText = dec.decode(base64ToBytes(String(privatePemB64).trim()));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemBodyToBytes(pemText, "PRIVATE KEY"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payloadBytes = enc.encode(JSON.stringify(payload));
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    payloadBytes
  ));

  return `ZYV1.${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(signature)}`;
}

async function fingerprintKey(key) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(key ?? "").trim())));
  return Array.from(hash.slice(0, 8), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function createSessionToken(env, licenseId, deviceId, version) {
  const payload = `${String(licenseId).toUpperCase()}|${String(deviceId).toUpperCase()}|${version}`;
  const sig = await hmac(env.ZYVEN_ADMIN_KEY, payload);
  return `ZYS1.${version}.${bytesToBase64Url(sig)}`;
}

async function validateSessionToken(env, token, licenseId, deviceId, expectedVersion) {
  if (!env.ZYVEN_ADMIN_KEY) return false;
  const parts = String(token ?? "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ZYS1") return false;

  const version = Number(parts[1]);
  if (!Number.isSafeInteger(version) || version < 0 || version !== Number(expectedVersion)) return false;

  let supplied;
  try { supplied = base64UrlToBytes(parts[2]); } catch { return false; }

  const payload = `${String(licenseId ?? "").trim().toUpperCase()}|${String(deviceId ?? "").trim().toUpperCase()}|${version}`;
  const expected = await hmac(env.ZYVEN_ADMIN_KEY, payload);
  return constantTimeEqual(supplied, expected);
}

function readSessionVersion(token) {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ZYS1") return null;
  const version = Number(parts[1]);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

async function hmac(secret, payload) {
  if (!secret) throw new Error("ZYVEN_ADMIN_KEY secret is missing.");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

function isAdmin(request, env) {
  const supplied = request.headers.get("X-Zyven-Admin-Key") ?? "";
  const expected = String(env.ZYVEN_ADMIN_KEY ?? "");
  if (!expected || supplied.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function normalizeDevice(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value || value === "AUTO") return "AUTO";
  if (value === "*") return "*";
  if (value.length < 8 || value.length > 64) return null;
  return /^[A-Z0-9_-]+$/.test(value) ? value : null;
}

function parseExpiry(raw) {
  const text = String(raw ?? "LIFETIME").trim();
  if (!text || text.toUpperCase() === "LIFETIME") return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const [y, m, d] = text.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d, 23, 59, 59);
  const dt = new Date(ms);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) return null;

  return Math.floor(ms / 1000);
}

function getPublicUrl(request, env) {
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

function pemBodyToBytes(pem, label) {
  const clean = String(pem)
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s+/g, "");
  return base64ToBytes(clean);
}

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

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function textJson(message, status) {
  return new Response(JSON.stringify(String(message ?? "")), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
