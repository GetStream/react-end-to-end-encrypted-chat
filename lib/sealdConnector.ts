/**
 * The Seald connector that identifies a Stream user. It's attached to the
 * user's Seald identity at signup (`createSignupJWT`), and used as a recipient
 * when a channel's encryption session is created.
 *
 * Seald connectors are `<identifier>@<appId>` and stored in clear text, so the
 * identifier is a SHA-256 hash of the Stream user ID: it never contains `@`
 * and doesn't expose the user ID. Used on the server and in the browser.
 */
export async function sealdConnector(userId: string, appId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(userId)
  );
  const identifier = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return { type: 'AP' as const, value: `${identifier}@${appId}` };
}
