'use server';

import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import { sealdConnector } from './sealdConnector';

/**
 * Creates the JWT that lets a new Seald identity join the app's team. It also
 * attaches the user's connector (see `sealdConnector`) to the identity, so
 * other users can encrypt for this user by their Stream user ID.
 *
 * The JWT secret needs the JOIN_TEAM (3) and ADD_CONNECTOR (4) permissions.
 *
 * Demo shortcut: the user ID comes from the client. In production, take it from
 * the authenticated session, or anyone could claim another user's connector.
 */
export async function createSignupJWT(userId: string) {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtSecretId = process.env.JWT_SECRET_ID;
  const appId = process.env.NEXT_PUBLIC_SEALD_APP_ID;

  if (!jwtSecret) {
    throw Error('No JWT Secret found');
  }

  if (!jwtSecretId) {
    throw Error('No JWT Secret ID found');
  }

  if (!appId) {
    throw Error('No Seald App ID found');
  }

  const token = new SignJWT({
    iss: jwtSecretId,
    jti: uuidv4(), // So the JWT is only usable once. The `random` generates a random string, with enough entropy to never repeat : a UUIDv4 would be a good choice.
    iat: Math.floor(Date.now() / 1000), // JWT valid only for 10 minutes. `Date.now()` returns the timestamp in milliseconds, this needs it in seconds.
    scopes: [3, 4], // PERMISSION_JOIN_TEAM, PERMISSION_ADD_CONNECTOR
    join_team: true,
    connector_add: await sealdConnector(userId, appId),
  }).setProtectedHeader({ alg: 'HS256' });

  const signupJWT = await token.sign(Buffer.from(jwtSecret, 'ascii'));
  return signupJWT;
}
