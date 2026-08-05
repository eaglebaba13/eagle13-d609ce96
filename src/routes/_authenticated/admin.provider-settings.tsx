import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import {
  disconnectProviderCredentialSettings,
  getProviderCredentialSettings,
  saveProviderCredentialSettings,
  testProviderCredentialSettings,
} from "@/lib/provider-foundation/provider-credentials.functions";
import type {
  ProviderCredentialKind,
  ProviderCredentialSetting,
  ProviderCredentialType,
} from "@/lib/provider-foundation/provider-credentials.types";
import { ProviderSettingsSection } from "@/lib/provider-foundation/provider-credentials-ui";

export const Route = createFileRoute("/_authenticated/admin/provider-settings")({
  component: AdminProviderSettingsPage,
  head: () => ({
    meta: [
      { title: "Admin · Provider Settings" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AdminProviderSettingsPage() {
  const loadSettings = useServerFn(getProviderCredentialSettings);
  const saveSettings = useServerFn(saveProviderCredentialSettings);
  const testSettings = useServerFn(testProviderCredentialSettings);
  const disconnectSettings = useServerFn(disconnectProviderCredentialSettings);
  const [settings, setSettings] = useState<Record<string, ProviderCredentialSetting>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshSettings() {
    const next = await loadSettings();
    setSettings(next as Record<string, ProviderCredentialSetting>);
  }

  useEffect(() => {
    void refreshSettings();
  }, [loadSettings]);

  async function handleSave(provider: ProviderCredentialKind, credentialType: ProviderCredentialType, value: string) {
    setBusy(true);
    setMessage(null);
    try {
      await saveSettings({ data: { provider, credentialType, value, enabled: true, storage: "DATABASE" } });
      await refreshSettings();
      setMessage(`Saved ${provider}/${credentialType}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(provider: ProviderCredentialKind, credentialType: ProviderCredentialType) {
    setBusy(true);
    try {
      const result = await testSettings({ data: { provider, credentialType } });
      await refreshSettings();
      setMessage(`Validated ${provider}/${credentialType}: ${result.status}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect(provider: ProviderCredentialKind, credentialType: ProviderCredentialType) {
    setBusy(true);
    try {
      await disconnectSettings({ data: { provider, credentialType } });
      await refreshSettings();
      setMessage(`Disconnected ${provider}/${credentialType}`);
    } finally {
      setBusy(false);
    }
  }

  const getSetting = (provider: ProviderCredentialKind, credentialType: ProviderCredentialType) =>
    settings[`${provider}:${credentialType}`] ?? {
      provider,
      credentialType,
      value: null,
      maskedValue: "••••••",
      status: "MISSING",
      source: "ENV",
      updatedAt: null,
      updatedBy: null,
      enabled: false,
      expiresAt: null,
    };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">ADMIN · PROVIDER SETTINGS</div>
          <h1 className="text-xl font-semibold text-white">Provider Settings</h1>
        </div>
        <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Secure server-side storage
        </div>
      </header>

      {message ? <div className="rounded border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-200">{message}</div> : null}
      {busy ? <div className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw className="h-4 w-4 animate-spin" /> Working…</div> : null}

      <section className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Credentials are stored encrypted in Supabase and never exposed in the UI.</div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProviderSettingsSection
          title="Upstox"
          provider="upstox"
          entries={[
            { key: "api_key", label: "API Key", setting: getSetting("upstox", "api_key") },
            { key: "api_secret", label: "API Secret", setting: getSetting("upstox", "api_secret") },
            { key: "access_token", label: "Access Token", setting: getSetting("upstox", "access_token") },
          ]}
          onSave={handleSave}
          onTest={handleTest}
          onDisconnect={handleDisconnect}
        />
        <ProviderSettingsSection
          title="Telegram"
          provider="telegram"
          entries={[
            { key: "bot_token", label: "Bot Token", setting: getSetting("telegram", "bot_token") },
            { key: "chat_id", label: "Chat ID", setting: getSetting("telegram", "chat_id") },
          ]}
          onSave={handleSave}
          onTest={handleTest}
          onDisconnect={handleDisconnect}
        />
        <ProviderSettingsSection
          title="CoinDCX"
          provider="coindcx"
          entries={[
            { key: "api_key", label: "API Key", setting: getSetting("coindcx", "api_key") },
            { key: "api_secret", label: "API Secret", setting: getSetting("coindcx", "api_secret") },
          ]}
          onSave={handleSave}
          onTest={handleTest}
          onDisconnect={handleDisconnect}
        />
        <ProviderSettingsSection
          title="Future Providers"
          provider="future"
          entries={[
            { key: "api_key", label: "API Key", setting: getSetting("future", "api_key") },
            { key: "api_secret", label: "API Secret", setting: getSetting("future", "api_secret") },
          ]}
          onSave={handleSave}
          onTest={handleTest}
          onDisconnect={handleDisconnect}
        />
      </div>
    </div>
  );
}
