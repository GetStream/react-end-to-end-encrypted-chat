import React, { useCallback } from 'react';
import { createContext, useContext, useState } from 'react';
import SealdSDK from '@seald-io/sdk'; // if your bundler supports the "browser" field in package.json (supported by Webpack 5)
import SealdSDKPluginSSKSPassword from '@seald-io/sdk-plugin-ssks-password';
import { EncryptionSession } from '@seald-io/sdk/lib/main.js';
import { Message, SendMessageOptions, StreamChat } from 'stream-chat';
import { DefaultStreamChatGenerics } from 'stream-chat-react';
import { registerUser } from './registerUser';
import { getDatabaseKey } from './getDatabaseKey';
import { preDerivePassword } from '../lib/helpers/preDerivePassword';

type SealdState = {
  sealdClient: typeof SealdSDK | undefined;
  encryptionSession: EncryptionSession | undefined;
  sealdId: string | undefined;
  loadingState: 'loading' | 'finished';
  initializeSeald: (userId: string, password: string) => void;
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
  encryptMessage: async () => {},
  decryptMessage: async () => '',
};

const SealdContext = createContext<SealdState>(initialValue);

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

      // const databaseKey = await getDatabaseKey(userId);
      // const databasePath = `seald-e2e-encrypted-chat-${userId}`;

      // Commenting out databaseKey and databasePath for now since it's giving an
      // "Already registered" error when retrieving the identity
      const seald = SealdSDK({
        appId,
        apiURL,
        // databaseKey,
        // databasePath,
        plugins: [SealdSDKPluginSSKSPassword(storageURL)],
      });

      let mySealdId: string | undefined = undefined;
      const derivedPassword = await preDerivePassword(password, userId);
      console.log('derivedPassword: ', derivedPassword);
      try {
        const { sealdId } = await seald.ssksPassword.retrieveIdentity({
          userId,
          derivedPassword,
        });
        mySealdId = sealdId;
      } catch (error) {
        console.error('[App] Error retrieving identity', error);
        // Identity not found, we need to register the user
        mySealdId = await registerUser(seald, userId, derivedPassword);
      }

      const session: EncryptionSession = await seald.createEncryptionSession({
        sealdIds: [mySealdId],
      });

      setMyState((myState) => {
        return {
          ...myState,
          sealdClient: seald,
          encryptionSession: session,
          sealdId: mySealdId,
          loadingState: 'finished',
        };
      });
    },
    []
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
      // let messageToSend = message;
      // if ((myState.sealdId, myState.encryptionSession)) {
      //   console.log('Starting message encryption');
      //   const encryptedMessage = await myState.encryptionSession.encryptMessage(
      //     message
      //   );

      //   console.log('encryptedMessage', encryptedMessage);
      //   messageToSend = encryptedMessage;
      // }
      // try {
      //   const channel = chatClient.channel('messaging', channelId);
      //   const sendResult = await channel.sendMessage({
      //     text: messageToSend,
      //     customMessageData,
      //     options,
      //   });

      //   console.log('sendResult', sendResult);
      // } catch (error) {
      //   console.log('error', error);
      // }
      console.log('Encrypting message: ', message);
    },
    // [myState.sealdId, myState.encryptionSession]
    []
  );

  const decryptMessage = useCallback(
    async (message: string, sessionId: string) => {
      //   let encryptionSession = myState.encryptionSession;
      //   if (!encryptionSession || encryptionSession.sessionId !== sessionId) {
      //     // Either there is no session, or it doesn't match with the session id
      //     console.log('No session found for decryption or session id mismatch');
      //     encryptionSession = await myState.sealdClient.retrieveEncryptionSession(
      //       {
      //         sessionId,
      //       }
      //     );
      //     console.log('encryptionSession: ', encryptionSession);
      //     setMyState((myState) => {
      //       return {
      //         ...myState,
      //         encryptionSession: encryptionSession,
      //       };
      //     });
      //   }

      //   console.log('Starting message decryption: ', message);
      //   const decryptedMessage =
      //     (await encryptionSession?.decryptMessage(message)) || message;
      //   console.log('Decrypted message: ', decryptedMessage);

      //   return decryptedMessage;
      // },
      console.log('Session ', sessionId, ', decrypting message: ', message);
      return message;
    },
    // [myState.encryptionSession, myState.sealdClient]
    []
  );

  const store: SealdState = {
    sealdClient: myState.sealdClient,
    encryptionSession: myState.encryptionSession,
    sealdId: myState.sealdId,
    loadingState: myState.loadingState,
    initializeSeald,
    encryptMessage,
    decryptMessage,
  };

  return (
    <SealdContext.Provider value={store}>{children}</SealdContext.Provider>
  );
};

export const useSealdContext = () => useContext(SealdContext);
