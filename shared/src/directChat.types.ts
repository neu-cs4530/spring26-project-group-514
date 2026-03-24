import { type MessageInfo } from "./message.types.ts";

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
  participants: [string, string];
  createdAt: Date;
}
