import { useSealdContext } from '@/contexts/SealdContext';
import { useEffect, useState } from 'react';
import { useMessageContext } from 'stream-chat-react';

export default function EncryptedMessage(): JSX.Element {
  const { message } = useMessageContext();
  const { decryptMessage } = useSealdContext();
  const [displayedMessage, setDisplayedMessage] = useState<string | undefined>(
    message.text
  );

  useEffect(() => {
    // Only messages the server has stored are encrypted: the optimistic copy of
    // a message that is still being sent (or failed to send) holds the plain text.
    if (message.text && message.status === 'received') {
      try {
        const sessionId = JSON.parse(message.text).sessionId;
        decryptMessage(message.text, sessionId).then(
          (decryptedMessage: string) => {
            setDisplayedMessage(decryptedMessage);
          }
        );
      } catch {
        console.log("Can't parse this message for decryption.");
        setDisplayedMessage(`UNENCRYPTED MESSAGE: ${message.text}`);
      }
    }
  }, [message.text, message.status, decryptMessage]);
  return (
    <div className='messageBubble'>
      <p>{displayedMessage}</p>
    </div>
  );
}
