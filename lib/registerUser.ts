'use client';

import type { SealdSDK } from '@seald-io/sdk/browser';
import { createSignupJWT } from './createSignupJWT';

export async function registerUser(
  seald: SealdSDK,
  userId: string,
  password: string
): Promise<string> {
  const signUpJWT = await createSignupJWT();
  const identity = await seald.initiateIdentity({
    signupJWT: signUpJWT,
  });
  await seald.ssksPassword.saveIdentity({ userId, password });
  return identity.sealdId;
}
