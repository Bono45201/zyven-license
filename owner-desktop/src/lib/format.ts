import type { LicenseRecord, ProductId } from "../types";

export function productName(product: string) {
  if (product === "ZYVEN-SOUND-TOOL") return "Sound Tool";
  if (product === "ZYVEN-GP-TOOL") return "GP Tool";
  return product || "Unknown";
}

export function shortProduct(product: string) {
  if (product === "ZYVEN-SOUND-TOOL") return "SOUND";
  if (product === "ZYVEN-GP-TOOL") return "GP";
  return product;
}

export function formatDateUnix(value: number, includeTime = false) {
  if (!value) return "Never";
  const date = new Date(value * 1000);
  const dateText = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
  if (!includeTime) return dateText;
  const timeText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
  return dateText + " · " + timeText;
}

export function formatDateMs(value: number) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function expiryText(value: number) {
  if (!value) return "Lifetime";
  return formatDateUnix(value);
}

export function isExpired(value: number) {
  return value > 0 && Math.floor(Date.now() / 1000) > value;
}

export function sessionText(record: LicenseRecord) {
  return Number(record.ActiveSessions || 0) > 0 ? "Online" : "Offline";
}

export function productScopeRecords(records: LicenseRecord[], product: "" | ProductId) {
  if (!product) return records;
  return records.filter((item) => item.Product === product);
}

export function maskFingerprint(value: string) {
  if (!value) return "—";
  if (value.length <= 16) return value;
  return value.slice(0, 8) + "…" + value.slice(-8);
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error.");
}
