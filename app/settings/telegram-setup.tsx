"use client";

import { useState, useTransition } from "react";
import { setTelegramChatId, sendTestPage } from "@/app/actions";

/**
 * Paging setup.
 *
 * The monitor is the reason this app exists, so its delivery channel gets an
 * explicit test button — a channel you have never seen fire is a channel you
 * cannot trust.
 */
export function TelegramSetup({ chatId }: { chatId: string | null }) {
  const [value, setValue] = useState(chatId ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="border-line flex items-baseline justify-between border-b py-3">
        <span className="label">paging</span>
        <span className={chatId ? "text-ink-dim text-xs" : "text-degraded text-xs"}>
          {chatId ? "telegram connected" : "not connected"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="chat">
          Telegram chat ID
        </label>
        <input
          id="chat"
          aria-label="Telegram chat ID"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="telegram chat id"
          inputMode="numeric"
          className="bg-surface border-line focus:border-line-hi text-ink placeholder:text-ink-mute min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none transition-colors"
        />
        <button
          disabled={pending || !value.trim()}
          onClick={() =>
            start(async () => {
              await setTelegramChatId(value.trim());
              setStatus("saved");
            })
          }
          className="border-line-hi bg-surface-hi text-ink hover:bg-line rounded border px-3 py-2 text-xs transition-colors disabled:opacity-60"
        >
          save
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          disabled={pending || !chatId}
          onClick={() =>
            start(async () => {
              const r = await sendTestPage();
              setStatus(r.ok ? "test page sent" : `failed: ${r.error}`);
            })
          }
          className="text-ink-mute hover:text-ink-dim min-h-7 rounded px-1 text-xs transition-colors disabled:opacity-50"
        >
          send test page
        </button>
        {status && <span className="text-ink-mute text-xs">{status}</span>}
      </div>

      <p className="text-ink-mute mt-3 text-xs leading-relaxed">
        Message @BotFather to create a bot, set TELEGRAM_BOT_TOKEN, then send
        your bot any message and read the chat id from
        api.telegram.org/bot&lt;token&gt;/getUpdates.
      </p>
    </div>
  );
}
