const MAILPIT = "http://127.0.0.1:54324";

type SearchResponse = { messages?: { ID: string }[] };
type MessageResponse = { Text?: string };

/** A fresh address per test so parallel tests never read each other's mail. */
export function uniqueEmail(label = "e2e") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${label}+${suffix}@example.com`;
}

/**
 * Polls the local Mailpit catcher until a message to `email` arrives (up to `timeoutMs`)
 * and returns the 6-digit code from its text body.
 */
export async function getOtpCode(email: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no message yet";

  while (Date.now() < deadline) {
    try {
      const search = await fetch(
        `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      const found = (await search.json()) as SearchResponse;
      const id = found.messages?.[0]?.ID;
      if (id) {
        const message = await fetch(`${MAILPIT}/api/v1/message/${id}`);
        const body = (await message.json()) as MessageResponse;
        const match = body.Text?.match(/\b(\d{6})\b/);
        if (match?.[1]) return match[1];
        lastError = "message has no 6-digit code";
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No OTP email for ${email} within ${timeoutMs}ms (${lastError})`);
}
