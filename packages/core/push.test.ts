import { describe, expect, it } from "vitest";
import {
  isPushToken,
  pushMessage,
  readPushResponse,
  splitPage,
  PUSH_CHANNEL,
} from "./push";
import { evaluateFade } from "./monitor";

describe("push tokens", () => {
  it("accepts both shapes Expo issues", () => {
    expect(isPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isPushToken("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
  });

  it("rejects anything else, including a stale Telegram chat id", () => {
    expect(isPushToken("123456789")).toBe(false);
    expect(isPushToken("")).toBe(false);
    expect(isPushToken(null)).toBe(false);
  });
});

describe("splitPage", () => {
  it("uses the headline as the title and the rest as the body", () => {
    const { title, body } = splitPage("DOWN 3 DAYS\n\nMinimum to get back up:\n→ shake");
    expect(title).toBe("DOWN 3 DAYS");
    expect(body).toBe("Minimum to get back up:\n→ shake");
  });

  it("never leaves the body empty, which renders as a blank row on Android", () => {
    const { title, body } = splitPage("SYSTEM STABLE");
    expect(title).toBe("four");
    expect(body).toBe("SYSTEM STABLE");
  });
});

describe("pushMessage", () => {
  const TOKEN = "ExponentPushToken[abc]";

  it("carries a real fade page end to end", () => {
    // The actual text the monitor composes, not a hand-written sample — this is
    // what proves the two halves still fit together.
    const fade = evaluateFade({
      down: 3,
      slammed: false,
      today: "2026-07-28",
      lastPagedOn: null,
      lastPagedLevel: null,
      topPlaybook: ["shake @ lunch", "10 minutes of anything"],
    });
    expect(fade.kind).toBe("page");
    if (fade.kind !== "page") return;

    const msg = pushMessage(TOKEN, fade.text, "uptime://");
    expect(msg.title).toBe("DOWN 3 DAYS");
    expect(msg.body).toContain("shake @ lunch");
    expect(msg.data.url).toBe("uptime://");
    expect(msg.channelId).toBe(PUSH_CHANNEL);
  });

  it("asks for a heads-up banner — a page that waits for the next unlock is late", () => {
    expect(pushMessage(TOKEN, "DOWN 3 DAYS\nget back up").priority).toBe("high");
  });

  it("omits the deep link rather than sending an empty one", () => {
    expect(pushMessage(TOKEN, "a\nb").data).toEqual({});
  });

  it("carries no emoji or decoration — the register does not change with the channel", () => {
    const msg = pushMessage(TOKEN, "DOWN 3 DAYS\n\nMinimum to get back up:\n→ walk");
    expect(msg.title + msg.body).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u);
  });
});

describe("readPushResponse", () => {
  it("accepts a good ticket", () => {
    expect(readPushResponse({ data: [{ status: "ok", id: "x" }] })).toEqual({
      ok: true,
      deviceUnregistered: false,
    });
  });

  it("flags a dead token so the caller can null it", () => {
    // THE case that matters. Expo returns HTTP 200 for this, so a caller that
    // only checks res.ok swallows every page from here on — and it looks like
    // nothing is wrong, which is the worst failure this system can have.
    const result = readPushResponse({
      data: [
        {
          status: "error",
          message: '"ExponentPushToken[x]" is not a registered push notification recipient device',
          details: { error: "DeviceNotRegistered" },
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.deviceUnregistered).toBe(true);
  });

  it("does not treat an ordinary error as a dead token", () => {
    const result = readPushResponse({
      data: [{ status: "error", message: "rate limited", details: { error: "TooManyRequests" } }],
    });
    expect(result.ok).toBe(false);
    // Nulling the token here would silently unsubscribe someone over a
    // transient failure.
    expect(result.deviceUnregistered).toBe(false);
  });

  it("survives a shape it does not recognise", () => {
    expect(readPushResponse(null).ok).toBe(false);
    expect(readPushResponse({}).ok).toBe(false);
    expect(readPushResponse({ data: {} }).ok).toBe(false);
  });

  it("reads a single ticket as well as an array", () => {
    expect(readPushResponse({ data: { status: "ok" } }).ok).toBe(true);
  });
});
