/**
 * Telegram paging.
 *
 * Plain text, no markdown decoration, no emoji. A page from this system reads
 * like a status alert because that is what it is — the same flat register for
 * "DOWN 3 DAYS" and "18 DAYS UP". That symmetry is deliberate: identical
 * treatment is what stops good news reading as praise.
 */
export async function sendPage(
  chatId: string,
  text: string,
  deepLink?: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };

  const body = deepLink ? `${text}\n\n${deepLink}` : text;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_notification: false,
        link_preview_options: { is_disabled: true },
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `telegram ${res.status}: ${await res.text()}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
