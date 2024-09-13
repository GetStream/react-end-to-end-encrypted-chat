'use server';

export async function getDatabaseKey(userId: string): Promise<string> {
  console.log('[Server] getDatabaseKey with userId: ', userId);
  const encoder = new TextEncoder();
  const data = encoder.encode(userId);
  const databaseKey = await crypto.subtle
    .digest('SHA-256', data)
    .then((hashBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      return `seald_database_key_${hashHex}`;
    });

  return databaseKey;
}
