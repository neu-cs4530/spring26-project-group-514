import { useContext } from "react";
import { NotificationContext, type NotificationState } from "../contexts/NotificationContext.ts";

export default function useNotifications(): NotificationState {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("NotificationContext is null.");
  }
  return context;
}
