import { type MessageInfo } from "./message.types.ts";
import type { SafeUserInfo } from "./user.types.ts";

/**
 * Represents client's direct chat with each other:
 * - `id`: the id to reference the direct chat.
 * - `participants`: the two users that are communicating with each other.
 * - `messages`: all messages sent between the two users.
 * - `createdAt`: the date the direct message was created
 */
export interface DirectChatInfo {
  id: string;
  participants: [string, string];
  messages: MessageInfo[];
  createdAt: Date;
}

/**
 * Represents a client facing summary of DMs
 * - `directChatId`: refers to DirectChatInfo ID
 * - `participants`: the two people involved in the DMs
 * - `createdAt`: the date the direct chat was created
 */
export interface DirectChatSummary {
  directChatId: string; // ID to referencing to DirectChatInfo
  participants: [SafeUserInfo, SafeUserInfo];
  createdAt: Date;
  unreadCount: number;
  lastMessageAt: Date | null;
}

/**
 * Payload emitted when a new message is sent in a DM conversation.
 * - `chatId`: the ID of the DM conversation
 * - `message`: the newly sent message
 */
export interface DmNewMessagePayload {
  chatId: string;
  message: MessageInfo;
}
