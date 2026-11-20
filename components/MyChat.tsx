import { useEffect, useMemo, useRef } from 'react';
import { ChannelPaginator } from 'stream-chat';
import type {
  ChannelFilters,
  ClientUser,
  SortParamRequest,
} from 'stream-chat';
import {
  ChannelHeader,
  ChannelNavigation,
  Chat,
  LoadingIndicator,
  MessageComposer,
  MessageList,
  ThreadHeader,
  WithComponents,
  useCreateChatClient,
} from 'stream-chat-react';
import {
  ChannelSlot,
  ChatView,
  ThreadSlot,
} from 'stream-chat-react/slot-layout';
import type { LayoutDescriptor } from 'stream-chat-react/slot-layout';
import 'stream-chat-react/dist/css/index.css';
import EncryptedMessage from './EncryptedMessage';
import { useSealdContext } from '@/contexts/SealdContext';

const layouts: LayoutDescriptor[] = [
  { id: 'channels', slots: ['channel', 'thread'] },
];
const overrides = { MessageUI: EncryptedMessage };

export default function MyChat({
  apiKey,
  user,
  token,
}: {
  apiKey: string;
  user: ClientUser;
  token: string;
}) {
  const chatClient = useCreateChatClient({
    apiKey: apiKey,
    tokenOrProvider: token,
    userData: user,
  });

  const { initializeSeald, loadingState, encryptMessage } = useSealdContext();
  const initializationRef = useRef(false);

  useEffect(() => {
    if (!initializationRef.current && loadingState === 'loading') {
      initializationRef.current = true;
      initializeSeald(user.id, 'password');
    }
  }, [initializeSeald, user.id, loadingState]);

  // Encrypt the text of every outgoing message (channel and thread replies)
  // before it is sent to Stream.
  useEffect(() => {
    if (!chatClient) return;
    chatClient.config.set({
      channel: {
        requestHandlers: {
          sendMessageRequest: async (params, defaultRequest) => {
            let messageToSend = params.message?.text;

            if (messageToSend) {
              messageToSend = await encryptMessage(messageToSend);
            }

            const sendResult = await defaultRequest({
              ...params,
              message: { ...params.message, text: messageToSend },
            });

            console.log('sendResult', sendResult);
            return sendResult;
          },
        },
      },
    });
  }, [chatClient, encryptMessage]);

  // Chat sorting options
  const paginator = useMemo(() => {
    if (!chatClient) return undefined;
    const sort: SortParamRequest[] = [
      { direction: -1, field: 'last_message_at' },
    ];
    const filters: ChannelFilters = {
      type: 'messaging',
      members: { $in: [user.id] },
    };
    return new ChannelPaginator({
      client: chatClient,
      id: 'my-channels',
      filters,
      sort,
      paginatorOptions: { pageSize: 10 },
    });
  }, [chatClient, user.id]);

  useEffect(() => {
    if (!chatClient || !paginator) return;
    chatClient.channelManager.insertPaginator({ paginator });
    return () => {
      chatClient.channelManager.removePaginator(paginator);
    };
  }, [chatClient, paginator]);

  if (!chatClient || !paginator || loadingState === 'loading') {
    return <LoadingIndicator />;
  }

  return (
    <Chat client={chatClient}>
      <WithComponents overrides={overrides}>
        <ChatView
          layouts={layouts}
          views={{
            channels: (
              <>
                <ChannelNavigation />
                <ChannelSlot slot='channel'>
                  <ChannelHeader />
                  <MessageList />
                  <MessageComposer />
                </ChannelSlot>
                <ThreadSlot slot='thread'>
                  <ThreadHeader />
                  <MessageList />
                  <MessageComposer />
                </ThreadSlot>
              </>
            ),
          }}
        />
      </WithComponents>
    </Chat>
  );
}
