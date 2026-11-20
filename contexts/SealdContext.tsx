import React, { useCallback, useContext, useRef } from 'react';
import { createContext, useState } from 'react';
import SealdSDK from '@seald-io/sdk'; // if your bundler supports the "browser" field in package.json (supported by Webpack 5)
import SealdSDKPluginSSKSPassword from '@seald-io/sdk-plugin-ssks-password';
import type { EncryptionSession } from '@seald-io/sdk/lib/main.js';
import { getDatabaseKey } from '@/lib/getDatabaseKey';
import { registerUser } from '@/lib/registerUser';

type SealdState = {
  sealdClient: ReturnType<typeof SealdSDK> | undefined;
  sealdId: string | undefined;
  /** The Stream user ID of the current user. */
  userId: string | undefined;
  loadingState: 'loading' | 'finished';
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
  decryptMessage: (message: string, sessionId: string) => Promise<string>;
  /**
   * Drops the channel's session, e.g. after its members changed. The next
   * message creates a new session for the current members.
   */
  resetChannelSession: (channelCid: string) => void;
};

const initialValue: SealdState = {
  sealdClient: undefined,
  sealdId: undefined,
  userId: undefined,
  loadingState: 'loading',
  initializeSeald: async () => {},
  encryptMessage: async () => {
    throw new Error('Seald is not initialized.');
  },
  decryptMessage: async () => {
    throw new Error('Seald is not initialized.');
  },
  resetChannelSession: () => {},
};

/** The Seald connector that identifies a Stream user (set at signup). */
const connectorFor = (userId: string, appId: string) => ({
  type: 'AP',
  value: `${userId}@${appId}`,
});

export const SealdContext = createContext<SealdState>(initialValue);

export const SealdContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [myState, setMyState] = useState<
    Pick<SealdState, 'sealdClient' | 'sealdId' | 'userId' | 'loadingState'>
  >({
    sealdClient: undefined,
    sealdId: undefined,
    userId: undefined,
    loadingState: 'loading',
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
          console.info('[App] No stored identity, registering the user', error);
          // 3. A new user: create the identity and save it.
          mySealdId = await registerUser(seald, userId, password);
        }
      }

      setMyState({
        sealdClient: seald,
        sealdId: mySealdId,
        userId,
        loadingState: 'finished',
      });
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
          const session = await sealdClient.createEncryptionSession(
            { connectors: others.map((id) => connectorFor(id, appId)) },
            { metadata: channelCid }
          );
          sessionsById.current.set(
            session.sessionId,
            Promise.resolve(session)
          );
          return session;
        })();
        sessionsByChannel.current.set(channelCid, sessionPromise);
        // Don't keep a failed session (e.g. a member without a Seald identity
        // yet): the next message tries again.
        sessionPromise.catch(() => {
          if (sessionsByChannel.current.get(channelCid) === sessionPromise) {
            sessionsByChannel.current.delete(channelCid);
          }
        });
      }

      const session = await sessionPromise;
      return session.encryptMessage(message);
    },
    [myState]
  );

  const decryptMessage = useCallback(
    async (message: string, sessionId: string) => {
      const sealdClient = myState.sealdClient;
      if (!sealdClient) {
        throw new Error('Seald is not initialized.');
      }

      let sessionPromise = sessionsById.current.get(sessionId);
      if (!sessionPromise) {
        sessionPromise = sealdClient.retrieveEncryptionSession({ sessionId });
        sessionsById.current.set(sessionId, sessionPromise);
        // Don't cache a failed retrieval, so a later render can try again.
        sessionPromise.catch(() => sessionsById.current.delete(sessionId));
      }

      const session = await sessionPromise;
      return session.decryptMessage(message);
    },
    [myState.sealdClient]
  );

  const resetChannelSession = useCallback((channelCid: string) => {
    sessionsByChannel.current.delete(channelCid);
  }, []);

  const store: SealdState = {
    sealdClient: myState.sealdClient,
    sealdId: myState.sealdId,
    userId: myState.userId,
    loadingState: myState.loadingState,
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
