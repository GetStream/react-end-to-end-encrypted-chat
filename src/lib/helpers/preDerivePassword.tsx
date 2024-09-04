/* frontend/src/utils/index.ts */
import { Buffer } from 'buffer'; // don't forget to `npm install buffer`
import scryptJs from 'scrypt-js'; // don't forget to `npm install scrypt-js`

export const encode = (password: string): Buffer =>
  Buffer.from(password.normalize('NFKC'), 'utf8');

export const hashPassword = async (
  password: string,
  salt: string
): Promise<string> =>
  // scryptJs returns Uint8Array so we convert it to a proper buffer
  // to avoid problems
  Buffer.from(
    await scryptJs.scrypt(encode(password), encode(salt), 16384, 8, 1, 64)
  ).toString('base64');

export async function preDerivePassword(
  password: string,
  userId: string
): Promise<string> {
  const fixedString = import.meta.env.VITE_APPLICATION_SALT;
  console.log('fixedString', fixedString);
  return await hashPassword(password, `${fixedString}|${userId}`);
}
