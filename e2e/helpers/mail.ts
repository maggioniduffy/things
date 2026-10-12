const MAILPIT = "http://127.0.0.1:54324";

/**
 * Deletes every caught message to `email`. Call it before requesting a second code for the same
 * address, so `getOtpCode` cannot return the first code while the new mail is still in flight.
 */
export async function clearMail(email: string) {
  const response = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok)
    throw new Error(`Mailpit refused to delete mail for ${email}: ${response.status}`);
}
