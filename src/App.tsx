import type { User } from 'stream-chat';
import { useCreateChatClient, Chat } from 'stream-chat-react';

import 'stream-chat-react/dist/css/v2/index.css';
import './layout.css';
import { useEffect } from 'react';
import MyChat from './components/MyChat';
import { useSealdContext } from './contexts/useSealdContext';

const apiKey = 'qpvbxh63nz6h';
// const userId = 'TestUser';
// const userName = 'TestUser';
// const userToken =
//   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiVGVzdFVzZXIifQ.GxZc2Q3CDNAXIYe_vAGoXEwVWUV4L9BspumCU4DF4Qw';
const userId = '75511395-951d-4944-ba0a-443b926a58dc';
const userName = 'User 3';
const userToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNzU1MTEzOTUtOTUxZC00OTQ0LWJhMGEtNDQzYjkyNmE1OGRjIn0.2K6sB7cU7s2us9m6DRJ-AohPgdbvQtaEcV7RqxJSqYg';

const user: User = {
  id: userId,
  name: userName,
  image: `https://getstream.io/random_png/?name=${userName}`,
};

const App = () => {
  const { loadingState, initializeSeald } = useSealdContext();

  const client = useCreateChatClient({
    apiKey,
    tokenOrProvider: userToken,
    userData: user,
  });

  useEffect(() => {
    initializeSeald(userId, 'password');
  }, [initializeSeald]);

  if (!client) return <div>Setting up client & connection...</div>;

  if (loadingState === 'loading') return <div>Loading Seald...</div>;

  return (
    <Chat client={client}>
      <MyChat userId={userId} />
    </Chat>
  );
};

export default App;
