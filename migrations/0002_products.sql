-- Zyven multi-product migration
-- Existing rows came from the retired GP Studio server, so mark them as legacy.
-- New keys use explicit product IDs such as ZYVEN-SOUND-TOOL and ZYVEN-GP-TOOL.

ALTER TABLE licenses
ADD COLUMN product TEXT NOT NULL DEFAULT 'ZYVEN-LEGACY';

ALTER TABLE deleted_licenses
ADD COLUMN product TEXT NOT NULL DEFAULT 'ZYVEN-LEGACY';

CREATE INDEX IF NOT EXISTS idx_licenses_product
ON licenses(product);

CREATE INDEX IF NOT EXISTS idx_licenses_product_status
ON licenses(product, status);

CREATE INDEX IF NOT EXISTS idx_deleted_product
ON deleted_licenses(product);
