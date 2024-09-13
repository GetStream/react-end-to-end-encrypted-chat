'use server';

import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';

export async function createSignupJWT() {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtSecretId = process.env.JWT_SECRET_ID;

  if (!jwtSecret) {
    throw Error('No JWT Secret found');
  }

  if (!jwtSecretId) {
    throw Error('No JWT Secret ID found');
  }

  const token = new SignJWT({
    iss: jwtSecretId,
    jti: uuidv4(), // So the JWT is only usable once. The `random` generates a random string, with enough entropy to never repeat : a UUIDv4 would be a good choice.
    iat: Math.floor(Date.now() / 1000), // JWT valid only for 10 minutes. `Date.now()` returns the timestamp in milliseconds, this needs it in seconds.
    scopes: [3], // PERMISSION_JOIN_TEAM
    join_team: true,
  }).setProtectedHeader({ alg: 'HS256' });

  const signupJWT = await token.sign(Buffer.from(jwtSecret, 'ascii'));
  return signupJWT;
}
