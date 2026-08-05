import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/auth/require-supabase-auth";
import {
  disconnectProviderCredentialSetting,
  loadProviderCredentialSetting,
  sanitizeProviderCredentialSettingForClient,
  saveProviderCredentialSetting,
  validateProviderCredentialConnection,
} from "./provider-credentials.server";
import type {
  DisconnectProviderCredentialInput,
  ProviderCredentialKind,
  ProviderCredentialSetting,
  ProviderCredentialType,
  SaveProviderCredentialInput,
} from "./provider-credentials.types";

async function requireProviderAdmin(context: {
  supabase: {
    rpc: (
      functionName: string,
      params: {
        _user_id: string;
        _role: string;
      },
    ) => Promise<{ data: boolean | null }>;
  };
  userId: string;
}) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  if (!isAdmin) {
    throw new Error("forbidden");
  }
}

export const getProviderCredentialSettings = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireProviderAdmin(context);

    const providers: ProviderCredentialKind[] = [
      "upstox",
      "telegram",
      "coindcx",
      "future",
    ];

    const credentialTypes: ProviderCredentialType[] = [
      "api_key",
      "api_secret",
      "access_token",
      "bot_token",
      "chat_id",
    ];

    const result: Record<string, ProviderCredentialSetting> = {};

    for (const provider of providers) {
      for (const credentialType of credentialTypes) {
        const record = await loadProviderCredentialSetting({
          provider,
          credentialType,
        });

        result[`${provider}:${credentialType}`] =
          sanitizeProviderCredentialSettingForClient(record);
      }
    }

    return result;
  });

export const saveProviderCredentialSettings = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await requireProviderAdmin(context);

    const payload = data as unknown as SaveProviderCredentialInput;

    const saved = await saveProviderCredentialSetting({
      ...payload,
      updatedBy: context.userId,
    });

    return sanitizeProviderCredentialSettingForClient(saved);
  });

export const testProviderCredentialSettings = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await requireProviderAdmin(context);

    const payload = data as unknown as {
      provider: ProviderCredentialKind;
      credentialType: ProviderCredentialType;
    };

    const validation = await validateProviderCredentialConnection({
      provider: payload.provider,
      credentialType: payload.credentialType,
      capability: "admin-validation",
    });

    return {
      status: validation.status,
      safeError: validation.safeError,
      validatedAt: validation.validatedAt,
    };
  });

export const disconnectProviderCredentialSettings = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await requireProviderAdmin(context);

    const payload = data as unknown as DisconnectProviderCredentialInput;

    const disconnected = await disconnectProviderCredentialSetting({
      ...payload,
      updatedBy: context.userId,
    });

    return sanitizeProviderCredentialSettingForClient(disconnected);
  });
