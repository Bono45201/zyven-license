import { normalizeProduct, unixNow } from "./config.js";
import { parseOpaqueLicenseKey, fingerprintKey } from "./crypto.js";

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
  const id = String(p.LicenseId ?? "").trim().toUpperCase();
  if (!id) return { ok: false, row: null, error: "License ID is missing." };
  const product = normalizeProduct(p.Product, false);
  if (!product) return { ok: false, row: null, error: "Unsupported product." };

  const deleted = await env.DB.prepare(`
    SELECT license_id FROM deleted_licenses
    WHERE product=? COLLATE NOCASE
      AND (license_id=? COLLATE NOCASE OR fingerprint=? COLLATE NOCASE)
    LIMIT 1
  `).bind(product, id, fingerprint).first();
  if (deleted) return { ok: false, row: null, error: "That exact license key was permanently deleted. Create a new key instead." };

  const byId = await getLicense(env, id);
  if (byId) {
    if (normalizeProduct(byId.product, false) !== product)
      return { ok: false, row: null, error: "This License ID is already registered for another product." };
    if (String(byId.fingerprint).toUpperCase() !== fingerprint.toUpperCase())
      return { ok: false, row: null, error: "A different license key already uses this License ID." };
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
  const parsed = parseOpaqueLicenseKey(key);
  if (!parsed.ok) return denied("INVALID", parsed.error);

  const requestedProduct = normalizeProduct(requestedProductRaw, false);
  if (!requestedProduct) return denied("PRODUCT", "Product ID is missing or unsupported.");

  const id = parsed.licenseId;
  const device = String(requestedDeviceId ?? "").trim().toUpperCase();
  if (!device) return denied("DEVICE", "Device ID is missing.", requestedProduct);
  const fingerprint = await fingerprintKey(key);

  const deleted = await env.DB.prepare(`
    SELECT license_id FROM deleted_licenses
    WHERE product=? COLLATE NOCASE
      AND (license_id=? COLLATE NOCASE OR fingerprint=? COLLATE NOCASE)
    LIMIT 1
  `).bind(requestedProduct, id, fingerprint).first();
  if (deleted) return denied("DELETED", "This license was permanently deleted by Zyven.", requestedProduct, device);

  let row = await getLicense(env, id);
  if (!row) return denied("UNREGISTERED", "This license is not registered on the Zyven server.", requestedProduct, device);

  const storedProduct = normalizeProduct(row.product, false);
  if (!storedProduct || storedProduct !== requestedProduct)
    return denied("PRODUCT", "This license belongs to another Zyven product.", storedProduct || "", device, row);
  if (String(row.fingerprint).toUpperCase() !== fingerprint.toUpperCase())
    return denied("INVALID", "This license does not match the registered key.", storedProduct, device, row);

  const status = String(row.status ?? "").toUpperCase();
  if (status === "REVOKED") return denied("REVOKED", "This license has been revoked by Zyven.", storedProduct, device, row);
  if (status === "PAUSED") return denied("PAUSED", "This license is temporarily paused.", storedProduct, device, row);
  if (Number(row.expires_utc ?? 0) > 0 && unixNow() > Number(row.expires_utc))
    return denied("EXPIRED", "This license has expired.", storedProduct, device, row);

  const storedDevice = String(row.device_id ?? "AUTO").toUpperCase();
  if (storedDevice === "AUTO") {
    await env.DB.prepare(`UPDATE licenses SET device_id=? WHERE license_id=?`).bind(device, id).run();
    row = await getLicense(env, id);
  } else if (storedDevice !== "*" && storedDevice !== device) {
    return denied("DEVICE", "This license is locked to another PC.", storedProduct, device, row);
  }

  return { allowed: true, status: "ACTIVE", message: "License active.", row, deviceId: device, product: storedProduct };
}
