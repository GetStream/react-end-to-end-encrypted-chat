# Secure a React Chat App With Seald's End-to-End Encryption

![HowToSecureVitePoweredApp-E2E-LinkedIn-1200x628](https://github.com/user-attachments/assets/952532e9-ca80-4d28-88d1-dff7802fb71f)


Integrate the highest layer of security into a chat app built upon [Stream](https://getstream.io/) to protect users' messages, media, and conversation history using [Seald](https://www.seald.io/).

## Run the project

This project is a Next.js application using the [Seald](https://docs.seald.io/en/sdk/) and [Stream Chat React SDK](https://getstream.io/chat/sdk/react/). You can use a GitHub Code Space to run the app or run it locally on your device. The `.env` file in the GitHub project requires your Seald credentials as well as your Stream project credentials (find a sample for the `.env` file in the [/.env.template] file). 

**Note**: Running the final project requires Stream and Seald SDKs credentials. Signup for [Stream](https://getstream.io/try-for-free/) and [Seald](https://dashboard.staging-0.seald.io/) accounts and follow the first article below to get started. The second article introduces you to fundamental concepts of E2EE. 


## What is encrypted

The rule for this demo: message content never reaches Stream in plain text. Message text is encrypted with a per-channel [Seald encryption session](https://docs.seald.io/en/sdk/guides/6-encryption-sessions.html) before it's sent. A message that can't be encrypted fails to send ("Not sent.") and is never sent as plain text.

- **Encrypted:** message text, including thread replies.
- **Turned off,** because their content can't be encrypted here: attachments and file uploads, link previews (they would send typed URLs to Stream), polls, shared location and message edits.
- **Not encrypted (metadata):** message, channel and user IDs, the thread a reply belongs to, the ID of a quoted message, the IDs of mentioned users, reactions, read state and timestamps.
- The channel list preview and message search work on the stored text, so they show ciphertext.

### How sessions work

- Each user's Seald identity gets a connector when it's created (`lib/sealdConnector.ts`, `lib/createSignupJWT.ts`). The connector is a SHA-256 hash of the Stream user ID plus the Seald app ID, so it doesn't expose the user ID. On another browser or device, the identity is restored from Seald's key storage (SSKS) with the user's password.
- The first message in a channel creates the channel's encryption session for all of its members' connectors. Members who haven't opened the app yet are included too, and can decrypt once they sign up. Every message carries its session ID, and readers retrieve the session by that ID.
- The encrypted payload includes the channel ID. A message copied into another channel shows as "Can't decrypt this message."
- When members are added or removed, or the connection recovers after a drop, the next message creates a new session for the current members. New members can't read messages sent before they joined.

### Setup

- The Seald JWT secret (`JWT_SECRET`, `JWT_SECRET_ID`) needs the **JOIN_TEAM** and **ADD_CONNECTOR** permissions.
- To try it with two users, open the app in a second browser profile with `?user=<another user ID>`, and add both users to a channel.
- Identities created by an earlier version of this app have no connector, so other users can't encrypt for them. Use new user IDs.

The token route, the signup JWT (it trusts the user ID sent by the client), the Seald database key (derived from the user ID) and the fixed SSKS password are demo shortcuts. Don't use them in production.

## Read our E2EE articles
- [Main Article: React App E2EE](https://getstream.io/blog/react-app-encryption)
- [E2EE Concepts: Encrypting an App End-to-End](https://getstream.io/blog/end-to-end-encryption)  




