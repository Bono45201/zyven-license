PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS licenses (
    license_id TEXT PRIMARY KEY COLLATE NOCASE,
    product TEXT NOT NULL DEFAULT 'ZYVEN-SOUND-TOOL' COLLATE NOCASE,
    fingerprint TEXT NOT NULL UNIQUE COLLATE NOCASE,
    customer TEXT NOT NULL DEFAULT 'Zyven User',
    role TEXT NOT NULL DEFAULT 'CUSTOMER',
    plan TEXT NOT NULL DEFAULT 'Lifetime',
    device_id TEXT NOT NULL DEFAULT 'AUTO',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    expires_utc INTEGER NOT NULL DEFAULT 0,
    created_utc INTEGER NOT NULL DEFAULT 0,
    last_seen_utc INTEGER NOT NULL DEFAULT 0,
    session_version INTEGER NOT NULL DEFAULT 0,
    session_last_seen_utc INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_licenses_product
ON licenses(product);

CREATE INDEX IF NOT EXISTS idx_licenses_product_status
ON licenses(product, status);

CREATE INDEX IF NOT EXISTS idx_licenses_status
ON licenses(status);

CREATE INDEX IF NOT EXISTS idx_licenses_last_seen
ON licenses(last_seen_utc);

CREATE TABLE IF NOT EXISTS deleted_licenses (
    license_id TEXT PRIMARY KEY COLLATE NOCASE,
    product TEXT NOT NULL DEFAULT 'ZYVEN-SOUND-TOOL' COLLATE NOCASE,
    fingerprint TEXT NOT NULL UNIQUE COLLATE NOCASE,
    customer TEXT NOT NULL DEFAULT 'Zyven User',
    deleted_utc INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_product
ON deleted_licenses(product);

CREATE INDEX IF NOT EXISTS idx_deleted_fingerprint
ON deleted_licenses(fingerprint);
