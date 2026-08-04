// Phase 44B / 67A - Server-only Telegram delivery for the morning brief.
// Reuses the deterministic splitter. Diagnostics expose only presence/status,
// never token values, chat IDs, headers, or raw Telegram responses.

import { splitBriefIntoParts, type BriefSection, type BriefPart } from "./telegram-splitter";

export type TelegramConfigFieldStatus = "PRESENT" | "MISSING" | "EMPTY" | "INVALID_FORMAT";
export type TelegramConfigurationStatus = "READY" | "CONFIG_MISSING" | "DISABLED";
export type TelegramDeliveryStatus = "DELIVERED" | "PARTIAL" | "FAILED" | "CONFIG_MISSING" | "SENDING" | "DUPLICATE";

export interface TelegramConfigurationPresence {
  readonly status: TelegramConfigurationStatus;
  readonly botToken: TelegramConfigFieldStatus;
  readonly chatId: TelegramConfigFieldStatus;
  readonly telegramEnabled: TelegramConfigFieldStatus;
  readonly morningBriefEnabled: TelegramConfigFieldStatus;
}

export interface DeliveryOutcome {
  readonly delivered: boolean;
  readonly status: TelegramDeliveryStatus;
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly parts: readonly BriefPart[];
  readonly messageIds: readonly number[];
  readonly error?: string;
}

interface TelegramEnvLike {
  readonly TELEGRAM_BOT_TOKEN?: string;
  readonly TELEGRAM_CHAT_ID?: string;
  readonly TELEGRAM_ENABLED?: string;
  readonly TELEGRAM_MORNING_BRIEF_ENABLED?: string;
}

type FetchLike = typeof fetch;

const deliveredIds = new Set<string>();
const inFlightDeliveryIds = new Set<string>();

function redactError(message: string): string {
  return message.replace(/token|secret|authorization|cookie|api[-_]?key|bearer|chat[_ -]?id/gi, "[REDACTED]").slice(0, 160);
}

function flagStatus(value: string | undefined, defaultEnabled = true): TelegramConfigFieldStatus {
  if (value == null) return defaultEnabled ? "PRESENT" : "MISSING";
  if (value.trim() === "") return "EMPTY";
  if (/^(1|true|yes|enabled|on|0|false|no|disabled|off)$/i.test(value.trim())) return "PRESENT";
  return "INVALID_FORMAT";
}

function isEnabledFlag(value: string | undefined, defaultEnabled = true): boolean {
  if (value == null) return defaultEnabled;
  return /^(1|true|yes|enabled|on)$/i.test(value.trim());
}

function tokenStatus(token: string | undefined): TelegramConfigFieldStatus {
  if (token == null) return "MISSING";
  if (token.trim() === "") return "EMPTY";
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token.trim()) ? "PRESENT" : "INVALID_FORMAT";
}

function chatStatus(chatId: string | undefined): TelegramConfigFieldStatus {
  if (chatId == null) return "MISSING";
  if (chatId.trim() === "") return "EMPTY";
  return /^-?\d+$/.test(chatId.trim()) || /^@[A-Za-z0-9_]{5,}$/.test(chatId.trim()) ? "PRESENT" : "INVALID_FORMAT";
}

export function validateTelegramMorningBriefConfiguration(env: TelegramEnvLike = process.env): TelegramConfigurationPresence {
  const telegramEnabled = flagStatus(env.TELEGRAM_ENABLED);
  const morningBriefEnabled = flagStatus(env.TELEGRAM_MORNING_BRIEF_ENABLED);
  const disabled = !isEnabledFlag(env.TELEGRAM_ENABLED) || !isEnabledFlag(env.TELEGRAM_MORNING_BRIEF_ENABLED);
  const botToken = tokenStatus(env.TELEGRAM_BOT_TOKEN);
  const chatId = chatStatus(env.TELEGRAM_CHAT_ID);
  const ready = botToken === "PRESENT" && chatId === "PRESENT" && telegramEnabled === "PRESENT" && morningBriefEnabled === "PRESENT" && !disabled;
  return Object.freeze({
    status: disabled ? "DISABLED" : ready ? "READY" : "CONFIG_MISSING",
    botToken,
    chatId,
    telegramEnabled,
    morningBriefEnabled,
  });
}

export function resetTelegramMorningBriefDeliveryForTests(): void {
  deliveredIds.clear();
  inFlightDeliveryIds.clear();
}

export async function deliverMorningBrief(input: {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly sections: readonly BriefSection[];
  readonly deliveryId?: string;
  readonly env?: TelegramEnvLike;
  readonly fetchImpl?: FetchLike;
}): Promise<DeliveryOutcome> {
  const parts = splitBriefIntoParts({
    reportId: input.reportId,
    generatedAt: input.generatedAt,
    sections: input.sections,
  });
  const deliveryId = input.deliveryId ?? `${input.reportId}|${input.generatedAt}`;
  if (deliveredIds.has(deliveryId)) {
    return { delivered: true, status: "DUPLICATE", attempted: 0, succeeded: 0, failed: 0, parts, messageIds: [] };
  }
  if (inFlightDeliveryIds.has(deliveryId)) {
    return { delivered: false, status: "SENDING", attempted: 0, succeeded: 0, failed: 0, parts, messageIds: [], error: "DELIVERY_IN_FLIGHT" };
  }

  const env = input.env ?? process.env;
  const config = validateTelegramMorningBriefConfiguration(env);
  if (config.status !== "READY") {
    return { delivered: false, status: config.status === "DISABLED" ? "FAILED" : "CONFIG_MISSING", attempted: 0, succeeded: 0, failed: 0, parts, messageIds: [], error: config.status };
  }
  if (parts.length === 0) {
    return { delivered: false, status: "FAILED", attempted: 0, succeeded: 0, failed: 0, parts, messageIds: [], error: "EMPTY_BRIEF" };
  }

  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? "";
  const fetcher = input.fetchImpl ?? fetch;
  const messageIds: number[] = [];
  let succeeded = 0;
  let failed = 0;
  let firstError: string | undefined;

  inFlightDeliveryIds.add(deliveryId);
  try {
    for (const part of parts) {
      try {
        const res = await fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: part.text, disable_web_page_preview: true }),
        });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: { message_id?: number }; description?: string } | null;
        if (res.ok && body?.ok && typeof body.result?.message_id === "number") {
          succeeded++;
          messageIds.push(body.result.message_id);
        } else {
          failed++;
          if (!firstError) firstError = redactError(body?.description ?? `HTTP ${res.status}`);
        }
      } catch (err) {
        failed++;
        if (!firstError) firstError = redactError(err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    inFlightDeliveryIds.delete(deliveryId);
  }

  const delivered = failed === 0 && succeeded === parts.length;
  if (delivered) deliveredIds.add(deliveryId);
  return {
    delivered,
    status: delivered ? "DELIVERED" : succeeded > 0 ? "PARTIAL" : "FAILED",
    attempted: parts.length,
    succeeded,
    failed,
    parts,
    messageIds,
    error: firstError,
  };
}
