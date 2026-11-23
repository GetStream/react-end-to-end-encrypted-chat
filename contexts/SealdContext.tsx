import React, { useCallback, useContext, useRef } from 'react';
import { createContext, useState } from 'react';
import SealdSDK from '@seald-io/sdk'; // if your bundler supports the "browser" field in package.json (supported by Webpack 5)
import SealdSDKPluginSSKSPassword from '@seald-io/sdk-plugin-ssks-password';
import type { EncryptionSession } from '@seald-io/sdk/lib/main.js';
import { getDatabaseKey } from '@/lib/getDatabaseKey';
import { registerUser } from '@/lib/registerUser';
import { sealdConnector } from '@/lib/sealdConnector';

type SealdState = {
  sealdClient: ReturnType<typeof SealdSDK> | undefined;
  sealdId: string | undefined;
  /** The Stream user ID of the current user. */
  userId: string | undefined;
  loadingState: 'loading' | 'finished' | 'error';
  /** Why Seald couldn't be initialized, when `loadingState` is `'error'`. */
  error: string | undefined;
  initializeSeald: (userId: string, password: string) => void;
  /**
   * Encrypts a message for everyone in the channel. Creates the channel's
   * encryption session on the first message, for the members `getMemberIds`
   * returns (Stream user IDs). Throws if the message can't be encrypted.
   */
  encryptMessage: (
    message: string,
    channelCid: string,
    getMemberIds: () => Promise<string[]>
  ) => Promise<string>;
  /**
   * Decrypts a message of the channel `channelCid`. Throws if it can't be
   * decrypted, or if it was encrypted for another channel.
   */
  decryptMessage: (
    message: string,
    sessionId: string,
    channelCid: string
  ) => Promise<string>;
  /**
   * Drops the session of a channel (or of all channels when no cid is given),
   * e.g. after its members changed. The next message creates a new session for
   * the current members.
   */
  resetChannelSession: (channelCid?: string) => void;
};

const initialValue: SealdState = {
  sealdClient: undefined,
  sealdId: undefined,
  userId: undefined,
  loadingState: 'loading',
  error: undefined,
  initializeSeald: async () => {},
  encryptMessage: async () => {
    throw new Error('Seald is not initialized.');
  },
  decryptMessage: async () => {
    throw new Error('Seald is not initialized.');
  },
  resetChannelSession: () => {},
};

// What SSKS throws when no identity is stored for the user
// (@seald-io/sdk-plugin-ssks-password, lib/keyStorage.js).
const SSKS_IDENTITY_NOT_FOUND = "Couldn't find identity with this user id";
// How long a failed session retrieval is remembered before it's retried.
const FAILED_RETRIEVAL_TTL_MS = 60_000;

/**
 * What gets encrypted: the text together with the channel it was sent to, so a
 * ciphertext copied into another channel isn't shown there.
 */
type EncryptedPayload = { cid: string; text: string };

export const SealdContext = createContext<SealdState>(initialValue);

export const SealdContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [myState, setMyState] = useState<
    Pick<
      SealdState,
      'sealdClient' | 'sealdId' | 'userId' | 'loadingState' | 'error'
    >
  >({
    sealdClient: undefined,
    sealdId: undefined,
    userId: undefined,
    loadingState: 'loading',
    error: undefined,
  });
  const initializationRef = useRef(false);
  // One encryption session per channel, keyed by the channel's cid. Caching the
  // promise means concurrent sends to a new channel create one session.
  const sessionsByChannel = useRef(
    new Map<string, Promise<EncryptionSession>>()
  );
  // Sessions retrieved for decryption, keyed by session id.
  const sessionsById = useRef(new Map<string, Promise<EncryptionSession>>());

  const initializeSeald = useCallback(
    async (userId: string, password: string) => {
      if (initializationRef.current) return;
      initializationRef.current = true;
      setMyState((state) => ({
        ...state,
        loadingState: 'loading',
        error: undefined,
      }));

      try {
        const appId = process.env.NEXT_PUBLIC_SEALD_APP_ID;
        const apiURL = process.env.NEXT_PUBLIC_SEALD_API_URL;
        const storageURL = process.env.NEXT_PUBLIC_KEY_STORAGE_URL;

        if (!appId) {
          throw Error("App ID can't be found.");
        }

        const databaseKey = await getDatabaseKey(userId);
        const databasePath = `seald-e2e-encrypted-chat-${userId}`;

        const seald = SealdSDK({
          appId,
          apiURL,
          databaseKey,
          databasePath,
          plugins: [SealdSDKPluginSSKSPassword(storageURL)],
        });
        await seald.initialize();

        let mySealdId: string | undefined = undefined;

        try {
          // 1. The identity is already in this browser's local database.
          const accountInfo = await seald.getCurrentAccountInfo();
          mySealdId = accountInfo?.sealdId;
        } catch {
          // Not in this browser.
        }

        if (!mySealdId) {
          try {
            // 2. The identity was saved from another browser or device.
            const accountInfo = await seald.ssksPassword.retrieveIdentity({
              userId,
              password,
            });
            mySealdId = accountInfo.sealdId;
          } catch (error) {
            // Register only when SSKS has no identity for this user. Any other
            // error (network, throttling, wrong password) must not replace the
            // stored identity, or the user loses access to their messages.
            if (
              !(error instanceof Error) ||
              !error.message.includes(SSKS_IDENTITY_NOT_FOUND)
            ) {
              throw error;
            }
            // 3. A new user: create the identity and save it.
            mySealdId = await registerUser(seald, userId, password);
          }
        }

        setMyState({
          sealdClient: seald,
          sealdId: mySealdId,
          userId,
          loadingState: 'finished',
          error: undefined,
        });
      } catch (error) {
        console.error('[App] Seald initialization failed', error);
        // Allow another attempt.
        initializationRef.current = false;
        setMyState((state) => ({
          ...state,
          loadingState: 'error',
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    []
  );

  const encryptMessage = useCallback(
    async (
      message: string,
      channelCid: string,
      getMemberIds: () => Promise<string[]>
    ) => {
      const { sealdClient, userId } = myState;
      const appId = process.env.NEXT_PUBLIC_SEALD_APP_ID;
      if (!sealdClient || !userId || !appId) {
        throw new Error('Seald is not initialized.');
      }

      let sessionPromise = sessionsByChannel.current.get(channelCid);
      if (!sessionPromise) {
        sessionPromise = (async () => {
          const memberIds = await getMemberIds();
          // The current user is added through `encryptForSelf` (the default).
          const others = memberIds.filter((id) => id !== userId);
          const connectors = await Promise.all(
            others.map((id) => sealdConnector(id, appId))
          );
          const session = await sealdClient.createEncryptionSession(
            { connectors },
            {
              metadata: channelCid,
              // Members who haven't opened the app yet have no Seald identity.
              // They're added by their connector and can decrypt once they
              // sign up, instead of blocking everyone else from sending.
              allowUnregisteredUsers: true,
            }
          );
          sessionsById.current.set(
            session.sessionId,
            Promise.resolve(session)
          );
          return session;
        })();
        sessionsByChannel.current.set(channelCid, sessionPromise);
        // Don't keep a failed session: the next message tries again.
        sessionPromise.catch(() => {
          if (sessionsByChannel.current.get(channelCid) === sessionPromise) {
            sessionsByChannel.current.delete(channelCid);
          }
        });
      }

      const session = await sessionPromise;
      const payload: EncryptedPayload = { cid: channelCid, text: message };
      return session.encryptMessage(JSON.stringify(payload));
    },
    [myState]
  );

  const decryptMessage = useCallback(
    async (message: string, sessionId: string, channelCid: string) => {
      const sealdClient = myState.sealdClient;
      if (!sealdClient) {
        throw new Error('Seald is not initialized.');
      }

      let sessionPromise = sessionsById.current.get(sessionId);
      if (!sessionPromise) {
        sessionPromise = sealdClient.retrieveEncryptionSession({ sessionId });
        sessionsById.current.set(sessionId, sessionPromise);
        // Remember a failed retrieval for a while (e.g. a session this user
        // isn't a recipient of), so re-renders don't flood Seald with requests.
        const failed = sessionPromise;
        failed.catch(() =>
          setTimeout(() => {
            if (sessionsById.current.get(sessionId) === failed) {
              sessionsById.current.delete(sessionId);
            }
          }, FAILED_RETRIEVAL_TTL_MS)
        );
      }

      const session = await sessionPromise;
      const decrypted = await session.decryptMessage(message);
      let payload: Partial<EncryptedPayload> | undefined;
      try {
        payload = JSON.parse(decrypted);
      } catch {
        // Not a payload of this app.
      }
      // Messages encrypted by earlier versions of the app hold the bare text.
      if (typeof payload?.cid !== 'string' || typeof payload.text !== 'string') {
        return decrypted;
      }
      if (payload.cid !== channelCid) {
        throw new Error('This message was not encrypted for this channel.');
      }
      return payload.text;
    },
    [myState.sealdClient]
  );

  const resetChannelSession = useCallback((channelCid?: string) => {
    if (channelCid) {
      sessionsByChannel.current.delete(channelCid);
    } else {
      sessionsByChannel.current.clear();
    }
  }, []);

  const store: SealdState = {
    sealdClient: myState.sealdClient,
    sealdId: myState.sealdId,
    userId: myState.userId,
    loadingState: myState.loadingState,
    error: myState.error,
    initializeSeald,
    encryptMessage,
    decryptMessage,
    resetChannelSession,
  };

  return (
    <SealdContext.Provider value={store}>{children}</SealdContext.Provider>
  );
};

export const useSealdContext = () => useContext(SealdContext);
