# Secure a React Chat App With Seald's End-to-End Encryption

![HowToSecureVitePoweredApp-E2E-LinkedIn-1200x628](https://github.com/user-attachments/assets/952532e9-ca80-4d28-88d1-dff7802fb71f)


Integrate the highest layer of security into a chat app built upon [Stream](https://getstream.io/) to protect users' messages, media, and conversation history using [Seald](https://www.seald.io/).

## Run the project

This project is a Next.js application using the [Seald](https://docs.seald.io/en/sdk/) and [Stream Chat React SDK](https://getstream.io/chat/sdk/react/). You can use a GitHub Code Space to run the app or run it locally on your device. The `.env` file in the GitHub project requires your Seald credentials as well as your Stream project credentials (find a sample for the `.env` file in the [/.env.template] file). 

**Note**: Running the final project requires Stream and Seald SDKs credentials. Signup for [Stream](https://getstream.io/try-for-free/) and [Seald](https://dashboard.staging-0.seald.io/) accounts and follow the first article below to get started. The second article introduces you to fundamental concepts of E2EE. 


## What is encrypted

The rule for this demo: message content never reaches Stream in plain text. Message text is encrypted with a [Seald encryption session](https://docs.seald.io/en/sdk/guides/6-encryption-sessions.html) before it's sent. A message that can't be encrypted fails to send ("Not sent.") and is never sent as plain text.

- **Encrypted:** message text, including thread replies.
- **Turned off,** because their content can't be encrypted here: attachments and file uploads, link previews (they would send typed URLs to Stream), polls, shared location and message edits.
- **Not encrypted (metadata):** message, channel and user IDs, the thread a reply belongs to, the ID of a quoted message, the IDs of mentioned users, reactions, read state and timestamps.
- The channel list preview and message search work on the stored text, so they show ciphertext.

**Status:** there are no encryption sessions yet, so every message currently fails to send. A channel needs one session whose recipients are all of its members' Seald identities. This app has no mapping from Stream users to Seald identities yet. The planned approach uses Seald [connectors](https://docs.seald.io/en/sdk/guides/jwt.html): add a `connector_add` claim (`${userId}@${appId}`) to the signup JWT, then create a channel's session for its members' connectors.

The token route, the Seald database key (derived from the user ID) and the fixed SSKS password are demo shortcuts. Don't use them in production.

## Read our E2EE articles
- [Main Article: React App E2EE](https://getstream.io/blog/react-app-encryption)
- [E2EE Concepts: Encrypting an App End-to-End](https://getstream.io/blog/end-to-end-encryption)  




