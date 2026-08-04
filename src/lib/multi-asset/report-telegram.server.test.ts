import { describe, expect, it, beforeEach } from "vitest";
import {
  deliverMorningBrief,
  resetTelegramMorningBriefDeliveryForTests,
  validateTelegramMorningBriefConfiguration,
} from "./report-telegram.server";
import type { BriefSection } from "./telegram-splitter";

const ENV = {
  TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyzABCDE",
  TELEGRAM_CHAT_ID: "-1001234567890",
  TELEGRAM_ENABLED: "true",
  TELEGRAM_MORNING_BRIEF_ENABLED: "true",
};

const SECTIONS: readonly BriefSection[] = [
  { id: "A", title: "Header", body: "Morning brief" },
  { id: "B", title: "Levels", body: "NIFTY 24000" },
];

describe("morning brief Telegram delivery", () => {
  beforeEach(() => resetTelegramMorningBriefDeliveryForTests());

  it("validates configuration presence without exposing values", () => {
    expect(validateTelegramMorningBriefConfiguration(ENV).status).toBe("READY");
    const missing = validateTelegramMorningBriefConfiguration({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "bad chat" });
    expect(missing.status).toBe("CONFIG_MISSING");
    expect(missing.botToken).toBe("EMPTY");
    expect(missing.chatId).toBe("INVALID_FORMAT");
    expect(JSON.stringify(missing)).not.toMatch(/123456789|-1001234567890|abcdefghijklmnopqrstuvwxyz/i);
  });

  it("sends chunked messages in deterministic order", async () => {
    const sent: string[] = [];
    const result = await deliverMorningBrief({
      reportId: "MB-1",
      generatedAt: "2026-08-02T02:45:00.000Z",
      sections: SECTIONS,
      deliveryId: "delivery-1",
      env: ENV,
      fetchImpl: async (_url, init) => {
        sent.push(String(JSON.parse(String(init?.body)).text));
        return new Response(JSON.stringify({ ok: true, result: { message_id: sent.length } }), { status: 200 });
      },
    });
    expect(result.status).toBe("DELIVERED");
    expect(result.messageIds).toEqual([1]);
    expect(sent[0]).toContain("1/1");
    expect(sent[0]).toContain("Morning brief");
    expect(sent[0]).toContain("NIFTY 24000");
  });

  it("classifies missing configuration without attempting Telegram", async () => {
    let calls = 0;
    const result = await deliverMorningBrief({
      reportId: "MB-2",
      generatedAt: "2026-08-02T02:45:00.000Z",
      sections: SECTIONS,
      env: {},
      fetchImpl: async () => {
        calls++;
        return new Response("{}", { status: 200 });
      },
    });
    expect(result.status).toBe("CONFIG_MISSING");
    expect(result.attempted).toBe(0);
    expect(calls).toBe(0);
  });

  it("sanitizes Telegram API failures", async () => {
    const result = await deliverMorningBrief({
      reportId: "MB-3",
      generatedAt: "2026-08-02T02:45:00.000Z",
      sections: SECTIONS,
      env: ENV,
      fetchImpl: async () => new Response(JSON.stringify({ ok: false, description: "bad token chat id authorization" }), { status: 401 }),
    });
    expect(result.status).toBe("FAILED");
    expect(result.error).not.toMatch(/token|chat id|authorization/i);
  });

  it("prevents duplicate sends for an already delivered delivery id", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return new Response(JSON.stringify({ ok: true, result: { message_id: calls } }), { status: 200 });
    };
    await deliverMorningBrief({ reportId: "MB-4", generatedAt: "2026-08-02T02:45:00.000Z", sections: SECTIONS, deliveryId: "same", env: ENV, fetchImpl });
    const duplicate = await deliverMorningBrief({ reportId: "MB-4", generatedAt: "2026-08-02T02:45:00.000Z", sections: SECTIONS, deliveryId: "same", env: ENV, fetchImpl });
    expect(duplicate.status).toBe("DUPLICATE");
    expect(calls).toBe(1);
  });

  it("prevents overlapping delivery for the same delivery id", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const first = deliverMorningBrief({
      reportId: "MB-5",
      generatedAt: "2026-08-02T02:45:00.000Z",
      sections: SECTIONS,
      deliveryId: "busy",
      env: ENV,
      fetchImpl: async () => {
        await pending;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
      },
    });
    const second = await deliverMorningBrief({ reportId: "MB-5", generatedAt: "2026-08-02T02:45:00.000Z", sections: SECTIONS, deliveryId: "busy", env: ENV, fetchImpl: async () => new Response("{}") });
    expect(second.status).toBe("SENDING");
    release();
    await first;
  });
});
