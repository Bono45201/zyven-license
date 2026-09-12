import { normalizeProduct, unixNow } from "./config.js";
import { parseAndVerifyLicense, fingerprintKey } from "./crypto.js";

export async function getLicense(env, id) {
  return env.DB.prepare(`SELECT * FROM licenses WHERE license_id=? COLLATE NOCASE LIMIT 1`)
    .bind(String(id ?? "").trim()).first();
}

export function toAdminRecord(row, activeSessions = 0) {
  if (!row) return null;
  return {
    LicenseId: row.license_id,
    Product: row.product,
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

export async function registerPayload(env, p, fingerprint) {
  const id = String(p.LicenseId ?? "").trim();
  if (!id) return { ok: false, row: null, error: "License ID is missing." };
  const product = normalizeProduct(p.Product, false);
  if (!product) return { ok: false, row: null, error: "Unsupported product." };

  const deleted = await env.DB.prepare(`
    SELECT license_id FROM deleted_licenses
    WHERE product=? COLLATE NOCASE
      AND (license_id=? COLLATE NOCASE OR fingerprint=? COLLATE NOCASE)
    LIMIT 1
  `).bind(product, id, fingerprint).first();
  if (deleted) return { ok: false, row: null, error: "That exact signed key was permanently deleted. Create a new key instead." };

  const byId = await getLicense(env, id);
  if (byId) {
    if (normalizeProduct(byId.product, false) !== product)
      return { ok: false, row: null, error: "This License ID is already registered for another product." };
    if (String(byId.fingerprint).toUpperCase() !== fingerprint.toUpperCase())
      return { ok: false, row: null, error: "A different signed key already uses this License ID." };
    return { ok: true, row: byId, error: "" };
  }

  const duplicate = await env.DB.prepare(`SELECT license_id FROM licenses WHERE fingerprint=? COLLATE NOCASE LIMIT 1`)
    .bind(fingerprint).first();
  if (duplicate) return { ok: false, row: null, error: "This key fingerprint is already registered under another License ID." };

  await env.DB.prepare(`
    INSERT INTO licenses (
      license_id,product,fingerprint,customer,role,plan,device_id,status,
      expires_utc,created_utc,last_seen_utc,session_version,session_last_seen_utc
    ) VALUES (?,?,?,?,?,?,?,'ACTIVE',?,?,0,0,0)
  `).bind(
    id, product, fingerprint,
    String(p.Customer ?? "").trim() || "Zyven User",
    String(p.Role ?? "").trim().toUpperCase() || "CUSTOMER",
    String(p.Plan ?? "").trim() || "Lifetime",
    String(p.DeviceId ?? "").trim().toUpperCase() || "AUTO",
    Number(p.ExpiresUtc ?? 0), unixNow()
  ).run();

  return { ok: true, row: await getLicense(env, id), error: "" };
}

function denied(status, message, product = "", deviceId = "", row = null) {
  return { allowed: false, status, message, row, deviceId, product };
}

export async function validateLicense(env, licenseKey, requestedDeviceId, requestedProductRaw) {
  const key = String(licenseKey ?? "").trim();
  const parsed = await parseAndVerifyLicense(key);
  if (!parsed.ok || !parsed.payload) return denied("INVALID", parsed.error);
  const p = parsed.payload;
  if (Number(p.Version) !== 2)
    return denied("UNSUPPORTED", "This server accepts server-managed v2 customer licenses only.");

  const signedProduct = normalizeProduct(p.Product, false);
  const requestedProduct = normalizeProduct(requestedProductRaw, false);
  if (!signedProduct) return denied("PRODUCT", "This license is for an unsupported Zyven product.");
  if (!requestedProduct) return denied("PRODUCT", "Product ID is missing or unsupported.", signedProduct);
  if (requestedProduct !== signedProduct) return denied("PRODUCT", "This license belongs to another Zyven product.", signedProduct);

  const id = String(p.LicenseId ?? "").trim();
  if (!id) return denied("INVALID", "License ID is missing.", signedProduct);
  const device = String(requestedDeviceId ?? "").trim().toUpperCase();
  if (!device) return denied("DEVICE", "Device ID is missing.", signedProduct);
  const fingerprint = await fingerprintKey(key);

  const deleted = await env.DB.prepare(`
    SELECT license_id FROM deleted_licenses
    WHERE product=? COLLATE NOCASE
      AND (license_id=? COLLATE NOCASE OR fingerprint=? COLLATE NOCASE)
    LIMIT 1
  `).bind(signedProduct, id, fingerprint).first();
  if (deleted) return denied("DELETED", "This license was permanently deleted by Zyven.", signedProduct, device);

  let row = await getLicense(env, id);
  if (!row) return denied("UNREGISTERED", "This license is not registered on the Zyven server.", signedProduct, device);
  if (normalizeProduct(row.product, false) !== signedProduct)
    return denied("PRODUCT", "The registered license product does not match this key.", signedProduct, device, row);
  if (String(row.fingerprint).toUpperCase() !== fingerprint.toUpperCase())
    return denied("INVALID", "This license does not match the registered key.", signedProduct, device, row);

  const status = String(row.status ?? "").toUpperCase();
  if (status === "REVOKED") return denied("REVOKED", "This license has been revoked by Zyven.", signedProduct, device, row);
  if (status === "PAUSED") return denied("PAUSED", "This license is temporarily paused.", signedProduct, device, row);
  if (Number(row.expires_utc ?? 0) > 0 && unixNow() > Number(row.expires_utc))
    return denied("EXPIRED", "This license has expired.", signedProduct, device, row);

  const stored = String(row.device_id ?? "AUTO").toUpperCase();
  if (stored === "AUTO") {
    await env.DB.prepare(`UPDATE licenses SET device_id=? WHERE license_id=?`).bind(device, id).run();
    row = await getLicense(env, id);
  } else if (stored !== "*" && stored !== device) {
    return denied("DEVICE", "This license is locked to another PC.", signedProduct, device, row);
  }

  return { allowed: true, status: "ACTIVE", message: "License active.", row, deviceId: device, product: signedProduct };
}
