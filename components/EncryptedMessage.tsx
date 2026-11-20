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
    if (!message.text || message.status !== 'received') {
      setDisplayedMessage(message.text);
      return;
    }

    let ignore = false;
    let sessionId: string | undefined;
    try {
      sessionId = JSON.parse(message.text).sessionId;
    } catch {
      // Not a Seald payload, e.g. a message sent before encryption was added.
    }
    if (!sessionId) {
      setDisplayedMessage(`UNENCRYPTED MESSAGE: ${message.text}`);
      return;
    }

    decryptMessage(message.text, sessionId)
      .then((decryptedMessage: string) => {
        if (!ignore) setDisplayedMessage(decryptedMessage);
      })
      .catch((error) => {
        console.error("Can't decrypt this message.", error);
        if (!ignore) setDisplayedMessage("Can't decrypt this message.");
      });

    return () => {
      ignore = true;
    };
  }, [message.text, message.status, decryptMessage]);

  return (
    <div className='messageBubble'>
      <p>{displayedMessage}</p>
      {message.status === 'failed' && (
        <p className='messageError'>Not sent.</p>
      )}
    </div>
  );
}
