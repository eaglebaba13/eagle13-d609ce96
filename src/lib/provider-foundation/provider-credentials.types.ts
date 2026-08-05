export type ProviderCredentialKind =
  | "upstox"
  | "telegram"
  | "coindcx"
  | "future";

export type ProviderCredentialType =
  | "api_key"
  | "api_secret"
  | "access_token"
  | "bot_token"
  | "chat_id";

export type ProviderCredentialStatus =
  | "READY"
  | "MISSING"
  | "INVALID"
  | "EXPIRED"
  | "DISABLED";

export type ProviderCredentialSource =
  | "ENV"
  | "DATABASE"
  | "CACHE";

export type ProviderCredentialFailureReason =
  | "DECRYPTION_FAILED";

export type ProviderCredentialValidationStatus =
  | "CONNECTED"
  | "AUTH_REQUIRED"
  | "EXPIRED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID"
  | "MARKET_CLOSED"
  | "UNKNOWN";

export interface ProviderCredentialSetting {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly value: string | null;
  readonly maskedValue: string;
  readonly status: ProviderCredentialStatus;
  readonly source: ProviderCredentialSource;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  readonly enabled: boolean;
  readonly expiresAt: string | null;
  readonly failureReason?: ProviderCredentialFailureReason;
}

export interface ProviderCredentialResolution {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly capability: string;
  readonly value: string | null;
  readonly maskedValue: string;
  readonly status: ProviderCredentialStatus;
  readonly source: ProviderCredentialSource;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  readonly enabled: boolean;
  readonly expiresAt: string | null;
  readonly failureReason?: ProviderCredentialFailureReason;
}

export interface SaveProviderCredentialInput {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly value: string;
  readonly updatedBy: string;
  readonly enabled?: boolean;
  readonly expiresAt?: string | null;
  readonly storage?: ProviderCredentialSource;
}

export interface DisconnectProviderCredentialInput {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly updatedBy: string;
}

export interface ProviderCredentialValidationResult {
  readonly status: ProviderCredentialValidationStatus;
  readonly safeError: string | null;
  readonly validatedAt: string | null;
}
