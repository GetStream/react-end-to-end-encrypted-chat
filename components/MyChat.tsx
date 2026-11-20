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

  // Plain text must never reach Stream. Every outgoing message (channel and
  // thread replies) is encrypted here, and a message that can't be encrypted
  // fails to send (the SDK marks it as failed) instead of going out as is.
  useEffect(() => {
    if (!chatClient) return;
    chatClient.config.set({
      channel: {
        requestHandlers: {
          sendMessageRequest: async (
            { localMessage, message, options },
            defaultRequest
          ) => {
            const {
              text,
              attachments,
              poll_id,
              shared_location,
              mml,
              custom,
            } = message ?? {};

            // Only the text is encrypted. Refuse anything that would carry
            // other content in plain text.
            if (
              attachments?.length ||
              poll_id ||
              shared_location ||
              mml ||
              (custom && Object.keys(custom).length)
            ) {
              throw new Error(
                'Only text messages can be encrypted. The message was not sent.'
              );
            }
            if (!text) {
              throw new Error('The message has no text to encrypt.');
            }

            const encryptedText = await encryptMessage(text, localMessage.cid);

            // Send an allowlist of fields: the encrypted text plus metadata
            // (ids, thread, quote and mentions), never other content.
            return defaultRequest({
              localMessage,
              options,
              message: {
                id: message?.id,
                text: encryptedText,
                parent_id: message?.parent_id,
                show_in_channel: message?.show_in_channel,
                quoted_message_id: message?.quoted_message_id,
                mentioned_users: message?.mentioned_users,
                silent: message?.silent,
                type: message?.type,
              },
            });
          },
          // Edits would go out unencrypted, and the message UI offers no edit
          // action. Refuse them in case one is added later.
          updateMessageRequest: async () => {
            throw new Error('Editing encrypted messages is not supported.');
          },
        },
      },
      // Turn off composer features whose content can't be encrypted. Link
      // previews would send typed URLs to Stream for enrichment while the user
      // types, and store the preview as a plain-text attachment.
      messageComposer: {
        attachments: { enabled: false },
        linkPreviews: { enabled: false },
        location: { enabled: false },
        polls: { enabled: false },
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
