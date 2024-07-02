import type {
  User,
  ChannelSort,
  ChannelFilters,
  ChannelOptions,
} from 'stream-chat';
import {
  useCreateChatClient,
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from 'stream-chat-react';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';

import SealdSDK from '@seald-io/sdk/browser'; // if your bundler supports the "browser" field in package.json (supported by Webpack 5)
import { SignJWT } from 'jose';

import 'stream-chat-react/dist/css/v2/index.css';
import './layout.css';
import { useCallback, useEffect } from 'react';

const apiKey = 'dz5f4d5kzrue';
const userId = 'royal-darkness-8';
const userName = 'royal';
const userToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoicm95YWwtZGFya25lc3MtOCIsImV4cCI6MTcxOTkzMDA1OH0.2riCvKvoWrbGtgltpN1jTerAIMxN0_gIIlytiQqSCzc';

const user: User = {
  id: userId,
  name: userName,
  image: `https://getstream.io/random_png/?name=${userName}`,
};

const sort: ChannelSort = { last_message_at: -1 };
const filters: ChannelFilters = {
  type: 'messaging',
  members: { $in: [userId] },
};
const options: ChannelOptions = {
  limit: 10,
};

// Seald credentials
const appId = import.meta.env.VITE_SEALD_APP_ID;
const apiURL = import.meta.env.VITE_API_URL;

const seald = SealdSDK({ appId, apiURL });

const App = () => {
  const registerSeald = useCallback(async function registerSeald() {
    const signUpJWT = await createSignupJWT();
    console.log('signUpJWT', signUpJWT);
    await seald.initiateIdentity({ signupJWT: signUpJWT });
  }, []);

  useEffect(() => {
    registerSeald();
  }, [registerSeald]);

  async function createSignupJWT() {
    'use server';

    const jwtSecret = import.meta.env.VITE_JWT_SECRET;
    const jwtSecretId = import.meta.env.VITE_JWT_SECRET_ID;
    console.log('jwtSecret', jwtSecret);
    console.log('jwtSecretId', jwtSecretId);

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

  const client = useCreateChatClient({
    apiKey,
    tokenOrProvider: userToken,
    userData: user,
  });

  if (!client) return <div>Setting up client & connection...</div>;

  return (
    <Chat client={client}>
      <ChannelList filters={filters} sort={sort} options={options} />
      <Channel>
        <Window>
          <ChannelHeader />
          <MessageList />
          <MessageInput
            overrideSubmitHandler={async (
              message,
              channelId,
              customMessageData,
              options
            ) => {
              console.log('message', message);
              if (message.text) {
                console.log('Starting message encryption');
                // const encryptedMessage = await seald.encryptMessage(
                //   message.text,
                //   { sealdIds: [sealdId.sealdId] }
                // );

                // console.log('encryptedMessage', encryptedMessage);
              }
            }}
          />
        </Window>
        <Thread />
      </Channel>
    </Chat>
  );
};

export default App;
