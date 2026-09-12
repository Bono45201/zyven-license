import {
  ACTIVE_SESSION_SECONDS, normalizeProduct, normalizeDevice, parseExpiry,
  productFromQuery, readJson, textJson, json, unixNow
} from "./config.js";
import { createOpaqueLicenseKey, fingerprintKey } from "./crypto.js";
import { getLicense, registerPayload, toAdminRecord } from "./db.js";

export async function adminList(request, env) {
  const product = productFromQuery(request);
  if (product === null) return textJson("Unsupported product.", 400);
  const now = unixNow();
  const rows = product
    ? await env.DB.prepare(`SELECT * FROM licenses WHERE product=? COLLATE NOCASE ORDER BY created_utc DESC`).bind(product).all()
    : await env.DB.prepare(`SELECT * FROM licenses ORDER BY created_utc DESC`).all();
  return json((rows.results ?? []).map(r => toAdminRecord(r, Number(r.session_last_seen_utc ?? 0) >= now - ACTIVE_SESSION_SECONDS ? 1 : 0)));
}

export async function adminDeleted(request, env) {
  const product = productFromQuery(request);
  if (product === null) return textJson("Unsupported product.", 400);
  const rows = product
    ? await env.DB.prepare(`SELECT * FROM deleted_licenses WHERE product=? COLLATE NOCASE ORDER BY deleted_utc DESC`).bind(product).all()
    : await env.DB.prepare(`SELECT * FROM deleted_licenses ORDER BY deleted_utc DESC`).all();
  return json((rows.results ?? []).map(r => ({
    LicenseId: r.license_id, Product: r.product, Fingerprint: r.fingerprint,
    Customer: r.customer, DeletedUtc: Number(r.deleted_utc ?? 0)
  })));
}

export async function adminImport() {
  return textJson("Import is disabled for server-generated ZYV2 keys. Create a new key from the Owner Manager instead.", 400);
}

export async function adminCreate(request, env) {
  const body = await readJson(request);
  const product = normalizeProduct(body?.product, true);
  if (!product) return textJson("Unsupported product.", 400);
  const expiry = parseExpiry(body?.expiry);
  if (expiry === null) return textJson("Expiry must be LIFETIME or yyyy-MM-dd.", 400);
  const customer = String(body?.customer ?? "").trim();
  const plan = String(body?.plan ?? "").trim();
  if (customer.length > 80 || plan.length > 40) return textJson("Customer or plan name is too long.", 400);
  const deviceId = normalizeDevice(body?.deviceId);
  if (deviceId === null) return textJson("Device ID must be AUTO, *, or a valid Zyven device ID.", 400);

  const licenseId = crypto.randomUUID().replaceAll("-", "").toUpperCase();
  const key = createOpaqueLicenseKey(licenseId);
  const payload = {
    Product: product,
    Customer: customer || "Zyven User",
    Role: "CUSTOMER",
    Plan: plan || "Lifetime",
    DeviceId: deviceId,
    LicenseId: licenseId,
    ExpiresUtc: expiry
  };
  const result = await registerPayload(env, payload, await fingerprintKey(key));
  if (!result.ok || !result.row) return textJson(result.error || "Could not register license.", 400);
  return json({ licenseKey: key, record: toAdminRecord(result.row, 0) });
}

export async function adminSetStatus(request, env, id) {
  const body = await readJson(request);
  const status = String(body?.status ?? "").trim().toUpperCase();
  if (!["ACTIVE", "PAUSED", "REVOKED"].includes(status))
    return textJson("Status must be ACTIVE, PAUSED or REVOKED.", 400);
  if (!(await getLicense(env, id))) return new Response(null, { status: 404 });
  if (status === "PAUSED" || status === "REVOKED")
    await env.DB.prepare(`UPDATE licenses SET status=?, session_version=session_version+1, session_last_seen_utc=0 WHERE license_id=?`).bind(status, id).run();
  else
    await env.DB.prepare(`UPDATE licenses SET status=? WHERE license_id=?`).bind(status, id).run();
  return json(toAdminRecord(await getLicense(env, id), 0));
}

export async function adminDelete(env, id) {
  const row = await getLicense(env, id);
  if (!row) return new Response(null, { status: 404 });
  const active = Number(row.session_last_seen_utc ?? 0) >= unixNow() - ACTIVE_SESSION_SECONDS ? 1 : 0;
  await env.DB.prepare(`INSERT OR IGNORE INTO deleted_licenses (license_id,product,fingerprint,customer,deleted_utc) VALUES (?,?,?,?,?)`)
    .bind(row.license_id, row.product, row.fingerprint, row.customer, unixNow()).run();
  await env.DB.prepare(`DELETE FROM licenses WHERE license_id=?`).bind(id).run();
  return json({ ok: true, removedSessions: active, deletedLicenseId: row.license_id, product: row.product, customer: row.customer });
}

export async function adminLogoutOne(env, id) {
  const row = await getLicense(env, id);
  if (!row) return new Response(null, { status: 404 });
  const removed = Number(row.session_last_seen_utc ?? 0) >= unixNow() - ACTIVE_SESSION_SECONDS ? 1 : 0;
  await env.DB.prepare(`UPDATE licenses SET session_version=session_version+1, session_last_seen_utc=0 WHERE license_id=?`).bind(id).run();
  return json({ ok: true, removed, invalidated: 1, product: row.product });
}

export async function adminLogoutAll(request, env) {
  const body = await readJson(request);
  const raw = String(body?.product ?? "").trim();
  const product = raw ? normalizeProduct(raw, false) : "";
  if (raw && !product) return textJson("Unsupported product.", 400);
  const now = unixNow();
  if (product) {
    const total = await env.DB.prepare(`SELECT COUNT(*) c FROM licenses WHERE product=?`).bind(product).first();
    const active = await env.DB.prepare(`SELECT COUNT(*) c FROM licenses WHERE product=? AND session_last_seen_utc>=?`).bind(product, now - ACTIVE_SESSION_SECONDS).first();
    await env.DB.prepare(`UPDATE licenses SET session_version=session_version+1, session_last_seen_utc=0 WHERE product=?`).bind(product).run();
    return json({ ok: true, product, removed: Number(active?.c ?? 0), invalidated: Number(total?.c ?? 0) });
  }
  const total = await env.DB.prepare(`SELECT COUNT(*) c FROM licenses`).first();
  const active = await env.DB.prepare(`SELECT COUNT(*) c FROM licenses WHERE session_last_seen_utc>=?`).bind(now - ACTIVE_SESSION_SECONDS).first();
  await env.DB.prepare(`UPDATE licenses SET session_version=session_version+1, session_last_seen_utc=0`).run();
  return json({ ok: true, product: "ALL", removed: Number(active?.c ?? 0), invalidated: Number(total?.c ?? 0) });
}

export async function adminResetDevice(env, id) {
  if (!(await getLicense(env, id))) return new Response(null, { status: 404 });
  await env.DB.prepare(`UPDATE licenses SET device_id='AUTO', session_version=session_version+1, session_last_seen_utc=0 WHERE license_id=?`).bind(id).run();
  return json(toAdminRecord(await getLicense(env, id), 0));
}

export async function adminSetExpiry(request, env, id) {
  const body = await readJson(request);
  const expiry = parseExpiry(body?.expiry);
  if (expiry === null) return textJson("Expiry must be LIFETIME or yyyy-MM-dd.", 400);
  if (!(await getLicense(env, id))) return new Response(null, { status: 404 });
  if (expiry > 0 && unixNow() > expiry)
    await env.DB.prepare(`UPDATE licenses SET expires_utc=?, session_version=session_version+1, session_last_seen_utc=0 WHERE license_id=?`).bind(expiry, id).run();
  else
    await env.DB.prepare(`UPDATE licenses SET expires_utc=? WHERE license_id=?`).bind(expiry, id).run();
  return json(toAdminRecord(await getLicense(env, id), 0));
}
