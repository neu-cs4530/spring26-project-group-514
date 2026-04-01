import { createRepo } from "./keyv.ts";
import type {
  AuthRecord,
  ChatRecord,
  CommentRecord,
  GameRecord,
  LobbyRecord,
  MessageRecord,
  ThreadRecord,
  UserRecord,
  GameHistoryRecord,
  FriendRequestRecord,
  DirectChatRecord,
  PlayerStatsRecord,
} from "./models.ts";

export const AuthRepo = createRepo<AuthRecord>("auth");
export const ChatRepo = createRepo<ChatRecord>("chat");
export const CommentRepo = createRepo<CommentRecord>("comment");
export const GameRepo = createRepo<GameRecord>("game");
export const MessageRepo = createRepo<MessageRecord>("message");
export const ThreadRepo = createRepo<ThreadRecord>("thread");
export const UserRepo = createRepo<UserRecord>("user");
export const LobbyRepo = createRepo<LobbyRecord>("lobby");
export const GameHistoryRepo = createRepo<GameHistoryRecord>("gameHistory");
export const FriendRequestRepo = createRepo<FriendRequestRecord>("friendRequest");
export const DirectChatRepo = createRepo<DirectChatRecord>("directChat");
export const PlayerStatsRepo = createRepo<PlayerStatsRecord>("playerStats");
