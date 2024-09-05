import React, { useCallback } from 'react';
import { createContext, useState } from 'react';
import SealdSDK from '@seald-io/sdk'; // if your bundler supports the "browser" field in package.json (supported by Webpack 5)
import SealdSDKPluginSSKSPassword from '@seald-io/sdk-plugin-ssks-password';
import { EncryptionSession } from '@seald-io/sdk/lib/main.js';
import { Message, SendMessageOptions, StreamChat } from 'stream-chat';
import { DefaultStreamChatGenerics } from 'stream-chat-react';
import { registerUser } from './registerUser';
import { getDatabaseKey } from './getDatabaseKey';

type SealdState = {
  sealdClient: typeof SealdSDK | undefined;
  encryptionSession: EncryptionSession | undefined;
  sealdId: string | undefined;
  loadingState: 'loading' | 'finished';
  initializeSeald: (userId: string, password: string) => void;
  createEncryptionSession: (sealdId: string, channelId: string) => void;
  encryptMessage: (
    message: string,
    channelId: string,
    chatClient: StreamChat,
    customMessageData: Partial<Message<DefaultStreamChatGenerics>> | undefined,
    options: SendMessageOptions | undefined
  ) => Promise<void>;
  decryptMessage: (message: string, sessionId: string) => Promise<string>;
};

const initialValue: SealdState = {
  sealdClient: undefined,
  encryptionSession: undefined,
  sealdId: undefined,
  loadingState: 'loading',
  initializeSeald: async () => {},
  createEncryptionSession: async () => {},
  encryptMessage: async () => {},
  decryptMessage: async () => '',
};

export const SealdContext = createContext<SealdState>(initialValue);

export const SealdContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [myState, setMyState] = useState<SealdState>(initialValue);

  const initializeSeald = useCallback(
    async (userId: string, password: string) => {
      const appId = import.meta.env.VITE_SEALD_APP_ID;
      const apiURL = import.meta.env.VITE_API_URL;
      const storageURL = import.meta.env.KEY_STORAGE_URL;

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

      setMyState((myState) => {
        return {
          ...myState,
          sealdClient: seald,
          sealdId: mySealdId,
          loadingState: 'finished',
        };
      });
    },
    []
  );

  const createEncryptionSession = useCallback(
    async (sealdId: string, channelId: string) => {
      const session = await myState.sealdClient.createEncryptionSession(
        {
          sealdIds: [sealdId],
        },
        { metadata: channelId }
      );
      return session;
    },
    [myState.sealdClient]
  );

  const encryptMessage = useCallback(
    async (
      message: string,
      channelId: string,
      chatClient: StreamChat,
      customMessageData:
        | Partial<Message<DefaultStreamChatGenerics>>
        | undefined,
      options: SendMessageOptions | undefined
    ) => {
      let messageToSend = message;
      if ((myState.sealdId, myState.encryptionSession)) {
        const encryptedMessage = await myState.encryptionSession.encryptMessage(
          message
        );

        messageToSend = encryptedMessage;
      }
      try {
        const channel = chatClient.channel('messaging', channelId);
        const sendResult = await channel.sendMessage({
          text: messageToSend,
          customMessageData,
          options,
        });

        console.log('sendResult', sendResult);
      } catch (error) {
        console.error('Error encrypting message: ', error);
      }
    },
    [myState.sealdId, myState.encryptionSession]
  );

  const decryptMessage = useCallback(
    async (message: string, sessionId: string) => {
      let encryptionSession = myState.encryptionSession;

      if (!encryptionSession || encryptionSession.sessionId !== sessionId) {
        // Either there is no session, or it doesn't match with the session id
        encryptionSession = await myState.sealdClient.retrieveEncryptionSession(
          {
            sessionId,
          }
        );
        setMyState((myState) => {
          return {
            ...myState,
            encryptionSession: encryptionSession,
          };
        });
      }

      const decryptedMessage =
        (await encryptionSession?.decryptMessage(message)) || message;
      return decryptedMessage;
    },
    [myState.encryptionSession, myState.sealdClient]
  );

  const store: SealdState = {
    sealdClient: myState.sealdClient,
    encryptionSession: myState.encryptionSession,
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
