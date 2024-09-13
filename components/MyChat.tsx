import type {
  ChannelSort,
  ChannelFilters,
  ChannelOptions,
  User,
} from 'stream-chat';
import {
  ChannelList,
  Chat,
  LoadingIndicator,
  useCreateChatClient,
} from 'stream-chat-react';
import MyChannel from './MyChannel';
import 'stream-chat-react/dist/css/v2/index.css';
import { useSealdContext } from '@/contexts/SealdContext';
import { useEffect, useRef } from 'react';

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

  const { initializeSeald, loadingState } = useSealdContext();
  const initializationRef = useRef(false);

  useEffect(() => {
    if (!initializationRef.current && loadingState === 'loading') {
      initializationRef.current = true;
      initializeSeald(user.id, 'password');
    }
  }, [initializeSeald, user.id, loadingState]);

  if (!chatClient || loadingState === 'loading') {
    return <LoadingIndicator />;
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
