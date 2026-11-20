import React, { useCallback, useContext, useRef } from 'react';
import { createContext, useState } from 'react';
import SealdSDK from '@seald-io/sdk'; // if your bundler supports the "browser" field in package.json (supported by Webpack 5)
import SealdSDKPluginSSKSPassword from '@seald-io/sdk-plugin-ssks-password';
import type {
  EncryptionSession,
  RecipientsWithRights,
} from '@seald-io/sdk/lib/main.js';
import { getDatabaseKey } from '@/lib/getDatabaseKey';
import { registerUser } from '@/lib/registerUser';

type SealdState = {
  sealdClient: ReturnType<typeof SealdSDK> | undefined;
  sealdId: string | undefined;
  loadingState: 'loading' | 'finished';
  initializeSeald: (userId: string, password: string) => void;
  /**
   * Creates the encryption session of a channel. The recipients must be all
   * channel members, so every member can decrypt. Nothing calls this yet: the
   * app has no mapping from Stream users to Seald identities (see README).
   */
  createEncryptionSession: (
    channelCid: string,
    recipients: RecipientsWithRights
  ) => Promise<EncryptionSession>;
  /** Encrypts with the channel's session. Throws if the channel has none. */
  encryptMessage: (message: string, channelCid: string) => Promise<string>;
  decryptMessage: (message: string, sessionId: string) => Promise<string>;
};

const initialValue: SealdState = {
  sealdClient: undefined,
  sealdId: undefined,
  loadingState: 'loading',
  initializeSeald: async () => {},
  createEncryptionSession: async () => {
    throw new Error('Seald is not initialized.');
  },
  encryptMessage: async () => {
    throw new Error('Seald is not initialized.');
  },
  decryptMessage: async () => {
    throw new Error('Seald is not initialized.');
  },
};

export const SealdContext = createContext<SealdState>(initialValue);

export const SealdContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [myState, setMyState] = useState<
    Pick<SealdState, 'sealdClient' | 'sealdId' | 'loadingState'>
  >({
    sealdClient: undefined,
    sealdId: undefined,
    loadingState: 'loading',
  });
  const initializationRef = useRef(false);
  // One encryption session per channel, keyed by the channel's cid.
  const sessionsByChannel = useRef(new Map<string, EncryptionSession>());
  // Sessions retrieved for decryption, keyed by session id. Caching the promise
  // means concurrent messages of the same session share one retrieval.
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
        const accountInfo = await seald.getCurrentAccountInfo();
        mySealdId = accountInfo.sealdId;
      } catch (error) {
        console.error('[App] Error retrieving identity', error);
        // Identity not found, we need to register the user
        mySealdId = await registerUser(seald, userId, password);
      }

      setMyState({
        sealdClient: seald,
        sealdId: mySealdId,
        loadingState: 'finished',
      });
    },
    []
  );

  const createEncryptionSession = useCallback(
    async (channelCid: string, recipients: RecipientsWithRights) => {
      if (!myState.sealdClient) {
        throw new Error('Seald is not initialized.');
      }
      const session = await myState.sealdClient.createEncryptionSession(
        recipients,
        { metadata: channelCid }
      );
      sessionsByChannel.current.set(channelCid, session);
      sessionsById.current.set(session.sessionId, Promise.resolve(session));
      return session;
    },
    [myState.sealdClient]
  );

  const encryptMessage = useCallback(
    async (message: string, channelCid: string) => {
      const session = sessionsByChannel.current.get(channelCid);
      if (!session) {
        // Fail closed: never fall back to sending the plain text.
        throw new Error(
          `No encryption session for channel ${channelCid}. The message was not sent.`
        );
      }
      return session.encryptMessage(message);
    },
    []
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

  const store: SealdState = {
    sealdClient: myState.sealdClient,
    sealdId: myState.sealdId,
    loadingState: myState.loadingState,
    initializeSeald,
    createEncryptionSession,
    encryptMessage,
    decryptMessage,
  };

  return (
    <SealdContext.Provider value={store}>{children}</SealdContext.Provider>
  );
};

export const useSealdContext = () => useContext(SealdContext);
