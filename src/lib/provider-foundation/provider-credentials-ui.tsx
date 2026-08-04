import { useState } from "react";
import { Eye, EyeOff, Shield, RefreshCw, Send } from "lucide-react";
import type { ProviderCredentialKind, ProviderCredentialSetting, ProviderCredentialType } from "./provider-credentials.server";

interface ProviderCredentialRowProps {
  readonly label: string;
  readonly setting: ProviderCredentialSetting;
  readonly onSave: (credentialType: ProviderCredentialType, value: string) => Promise<void> | void;
  readonly onTest: (credentialType: ProviderCredentialType) => Promise<void> | void;
  readonly onDisconnect: (credentialType: ProviderCredentialType) => Promise<void> | void;
}

export function ProviderCredentialRow({ label, setting, onSave, onTest, onDisconnect }: ProviderCredentialRowProps) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-xs text-slate-400">{setting.status} · {setting.source}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { void onTest(setting.credentialType); }} className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200">
            <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" />Test</span>
          </button>
          <button type="button" onClick={() => { void onDisconnect(setting.credentialType); }} className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200">
            Disconnect
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={setting.maskedValue}
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
        <button type="button" onClick={() => setShow((v) => !v)} className="rounded border border-slate-700 p-2 text-slate-200">
          {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button type="button" onClick={() => { setValue(""); void onSave(setting.credentialType, value); }} className="rounded border border-emerald-600/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
          Save
        </button>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        Updated: {setting.updatedAt ?? "never"} · By: {setting.updatedBy ?? "system"}
      </div>
    </div>
  );
}

export function ProviderSettingsSection({
  title,
  provider,
  entries,
  onSave,
  onTest,
}: {
  readonly title: string;
  readonly provider: ProviderCredentialKind;
  readonly entries: Array<{ readonly key: ProviderCredentialType; readonly label: string; readonly setting: ProviderCredentialSetting }>;
  readonly onSave: (provider: ProviderCredentialKind, credentialType: ProviderCredentialType, value: string) => Promise<void> | void;
  readonly onTest: (provider: ProviderCredentialKind, credentialType: ProviderCredentialType) => Promise<void> | void;
  readonly onDisconnect: (provider: ProviderCredentialKind, credentialType: ProviderCredentialType) => Promise<void> | void;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-300" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      <div className="space-y-3">
        {entries.map((entry) => (
          <ProviderCredentialRow
            key={`${provider}:${entry.key}`}
            label={entry.label}
            setting={entry.setting}
            onSave={(credentialType, value) => onSave(provider, credentialType, value)}
            onTest={(credentialType) => onTest(provider, credentialType)}
            onDisconnect={(credentialType) => onDisconnect(provider, credentialType)}
          />
        ))}
      </div>
    </section>
  );
}
