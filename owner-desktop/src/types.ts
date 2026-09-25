export type ProductId = "ZYVEN-SOUND-TOOL" | "ZYVEN-GP-TOOL";
export type ProductScope = "" | ProductId;
export type LicenseStatus = "ACTIVE" | "PAUSED" | "REVOKED";

export interface LicenseRecord {
  LicenseId: string;
  Product: ProductId | string;
  Fingerprint: string;
  Customer: string;
  Role: string;
  Plan: string;
  DeviceId: string;
  Status: LicenseStatus | string;
  ExpiresUtc: number;
  CreatedUtc: number;
  LastSeenUtc: number;
  ActiveSessions: number;
}

export interface DeletedLicense {
  LicenseId: string;
  Product: string;
  Fingerprint: string;
  Customer: string;
  DeletedUtc: number;
}

export interface HealthPayload {
  ok: boolean;
  service: string;
  version: string;
  products: string[];
  defaultProduct: string;
  sessionMode: string;
  publicUrl: string;
}

export interface CreateLicensePayload {
  product: ProductId;
  customer: string;
  plan: string;
  deviceId: string;
  expiry: string;
}

export interface CreateLicenseResult {
  licenseKey: string;
  record: LicenseRecord;
}

export interface ActivityEntry {
  id: string;
  at: number;
  type: string;
  title: string;
  detail: string;
  meta?: Record<string, unknown>;
}

export interface OwnerSettings {
  autoRefreshSeconds: 0 | 15 | 30 | 60 | 120;
  compactRows: boolean;
  confirmDestructive: boolean;
}

export type PageId = "dashboard" | "licenses" | "create" | "activity" | "settings";

declare global {
  interface Window {
    zyvenOwner: {
      getVersion(): Promise<string>;
      window: {
        minimize(): Promise<void>;
        maximizeToggle(): Promise<boolean>;
        isMaximized(): Promise<boolean>;
        close(): Promise<void>;
      };
      connect(payload: { baseUrl: string; adminKey: string }): Promise<{
        health: HealthPayload;
        licenses: LicenseRecord[];
        baseUrl: string;
      }>;
      disconnect(): Promise<{ ok: boolean }>;
      list(product?: ProductScope): Promise<LicenseRecord[]>;
      deleted(product?: ProductScope): Promise<DeletedLicense[]>;
      createLicense(payload: CreateLicensePayload): Promise<CreateLicenseResult>;
      setStatus(licenseId: string, status: LicenseStatus): Promise<LicenseRecord>;
      resetDevice(licenseId: string): Promise<LicenseRecord>;
      forceLogout(licenseId: string): Promise<{ ok: boolean; removed: number; invalidated: number; product: string }>;
      logoutAll(product?: ProductScope): Promise<{ ok: boolean; product: string; removed: number; invalidated: number }>;
      setExpiry(licenseId: string, expiry: string): Promise<LicenseRecord>;
      deleteLicense(licenseId: string): Promise<{ ok: boolean; deletedLicenseId: string; product: string; customer: string }>;
      getFullKey(licenseId: string): Promise<string>;
      copyText(value: string): Promise<{ ok: boolean }>;
      activity(): Promise<ActivityEntry[]>;
      clearActivity(): Promise<{ ok: boolean }>;
    };
  }
}

export {};
