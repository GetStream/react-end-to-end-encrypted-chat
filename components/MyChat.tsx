import type {
  ChannelSort,
  ChannelFilters,
  ChannelOptions,
  User,
} from 'stream-chat';
import { ChannelList, Chat, useCreateChatClient } from 'stream-chat-react';
import MyChannel from './MyChannel';
import 'stream-chat-react/dist/css/v2/index.css';
import { useSealdContext } from '@/contexts/SealdContext';
import { useEffect, useState } from 'react';

export default function MyChat({
  apiKey,
  user,
  token,
}: {
  apiKey: string;
  user: User;
  token: string;
}) {
  const chatClient = useCreateChatClient({
    apiKey: apiKey,
    tokenOrProvider: token,
    userData: user,
  });

  const [initializing, setInitializing] = useState(false);
  const { initializeSeald } = useSealdContext();

  useEffect(() => {
    console.log(
      'Initialize seald with ',
      user.id,
      ', initializing: ',
      initializing
    );
    if (!initializing) {
      setInitializing(true);
      initializeSeald(user.id, 'password');
    }
  }, [initializeSeald, user.id, initializing]);

  if (!chatClient) {
    return <div>Error, please try again later.</div>;
  }

  // Chat sorting options
  const sort: ChannelSort = { last_message_at: -1 };
  const filters: ChannelFilters = {
    type: 'messaging',
    members: { $in: [user.id] },
  };
  const options: ChannelOptions = {
    limit: 10,
  };

  return (
    <Chat client={chatClient}>
      <ChannelList filters={filters} sort={sort} options={options} />
      <MyChannel />
    </Chat>
  );
}
