import {
  ChannelHeader,
  MessageList,
  MessageInput,
  Channel,
  Window,
  Thread,
  useChatContext,
} from 'stream-chat-react';
import EncryptedMessage from './EncryptedMessage';
import { useSealdContext } from '@/contexts/SealdContext';

export default function MyChannel() {
  const { client } = useChatContext();
  const { encryptMessage } = useSealdContext();

  return (
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
            let messageToSend = message.text;
            const extractedChannelId = channelId.split(':')[1];

            if (message.text) {
              messageToSend = await encryptMessage(message.text);
            }

            try {
              const channel = client.channel('messaging', extractedChannelId);
              const sendResult = await channel.sendMessage({
                text: messageToSend,
                customMessageData,
                options,
              });

              console.log('sendResult', sendResult);
            } catch (error) {
              console.error('Error encrypting message: ', error);
            }
          }}
        />
      </Window>
      <Thread />
    </Channel>
  );
}
