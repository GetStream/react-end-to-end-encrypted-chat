import type { ChannelSort, ChannelFilters, ChannelOptions } from 'stream-chat';
import {
  Channel,
  ChannelHeader,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window,
  useChatContext,
} from 'stream-chat-react';
import EncryptedMessage from '../EncryptedMessage';
import { useEffect } from 'react';
import { useSealdContext } from '../contexts/useSealdContext';

export default function MyChat({ userId }: { userId: string }) {
  const { sealdId, createEncryptionSession, encryptMessage } =
    useSealdContext();
  const { client, channel } = useChatContext();

  // Chat sorting options
  const sort: ChannelSort = { last_message_at: -1 };
  const filters: ChannelFilters = {
    type: 'messaging',
    members: { $in: [userId] },
  };
  const options: ChannelOptions = {
    limit: 10,
  };

  useEffect(() => {
    if (channel?.cid) {
      createEncryptionSession(sealdId, channel.cid);
    }
  }, [channel, sealdId, createEncryptionSession]);

  return (
    <>
      <ChannelList filters={filters} sort={sort} options={options} />
      <Channel Message={EncryptedMessage}>
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
              const messageToSend = message.text;
              const extractedChannelId = channelId.split(':')[1];

              if (messageToSend) {
                await encryptMessage(
                  messageToSend,
                  extractedChannelId,
                  client,
                  customMessageData,
                  options
                );
              }
            }}
          />
        </Window>
        <Thread />
      </Channel>
    </>
  );
}
