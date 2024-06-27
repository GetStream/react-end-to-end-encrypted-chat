import type { User, ChannelSort, ChannelFilters, ChannelOptions } from 'stream-chat';
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

import SealdSDK from '@seald-io/sdk/browser' // if your bundler supports the "browser" field in package.json (supported by Webpack 5)

import 'stream-chat-react/dist/css/v2/index.css';
import './layout.css';

// Seald credentials
const appId = "your_app_id_here"; // Replace "your_app_id_here" with your actual app ID.
const apiURL = "https://your.api.url.here";

const apiKey = 'dz5f4d5kzrue';
const userId = 'little-unit-1';
const userName = 'little';
const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoibGl0dGxlLXVuaXQtMSIsImV4cCI6MTcxOTMxOTc3N30.KFPpxzxQz40RP_fUA_AeustoTGadk-hFGTHEi3x75HA';

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

const seald = SealdSDK({ appId, apiURL })

const App = () => {
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
          <MessageInput />
        </Window>
        <Thread />
      </Channel>
    </Chat>
  );
};

export default App;