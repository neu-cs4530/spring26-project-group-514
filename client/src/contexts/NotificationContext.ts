import { createContext } from "react";

export interface NotificationState {
  friendRequestCount: number;
  totalUnreadMessages: number;
  dmUnreads: Record<string, number>;
  dmLastMessageAt: Record<string, Date>;
  markDmRead: (chatId: string) => void;
  clearActiveDm: () => void;
}

export const NotificationContext = createContext<NotificationState | null>(null);
