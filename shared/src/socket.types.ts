import {
  type ChatInfo,
  type ChatMoveLogPayload,
  type ChatNewMessagePayload,
  type ChatUserJoinedPayload,
  type ChatUserLeftPayload,
} from "./chat.types.ts";
import { type NewMessagePayload } from "./message.types.ts";
import { type WithAuth } from "./auth.types.ts";
import {
  type GameMakeMovePayload,
  type GamePlayInfo,
  type GameScoresPayload,
  type TaggedGameView,
} from "./game.types.ts";
import { type FriendRequest } from "./friend.types.ts";
import { type SafeUserInfo } from "./user.types.ts";
import { type DirectChatInfo, type DmNewMessagePayload } from "./directChat.types.ts";
import { type LobbyInfo, type LobbySettingsPayload } from "./lobby.types.ts";

/**
 * The Socket.io interface for client to server communication
 */
export interface ClientToServerEvents {
  chatJoin: (payload: WithAuth<string>) => void;
  chatLeave: (payload: WithAuth<string>) => void;
  chatSendMessage: (payload: WithAuth<NewMessagePayload>) => void;
  gameJoinAsPlayer: (payload: WithAuth<string>) => void;
  gameMakeMove: (payload: WithAuth<GameMakeMovePayload>) => void;
  gameStart: (payload: WithAuth<string>) => void;
  gameWatch: (payload: WithAuth<string>) => void;
  registerUser: (payload: WithAuth<null>) => void; // Maps an anonymous socket connection to a specific user
  dmJoin: (payload: WithAuth<string>) => void;
  dmLeave: (payload: WithAuth<string>) => void;
  dmSendMessage: (payload: WithAuth<NewMessagePayload>) => void;
  lobbyWatch: (payload: WithAuth<string>) => void;
  lobbyUnwatch: (payload: WithAuth<string>) => void;
  lobbyJoin: (payload: WithAuth<string>) => void;
  lobbyLeave: (payload: WithAuth<string>) => void;
  lobbyInvitePlayer: (payload: WithAuth<{ lobbyId: string; username: string }>) => void;
  lobbyDeclineInvite: (payload: WithAuth<string>) => void;
  lobbyRemovePlayer: (payload: WithAuth<{ lobbyId: string; username: string }>) => void;
  lobbyUpdateSettings: (
    payload: WithAuth<{ lobbyId: string; settings: LobbySettingsPayload }>,
  ) => void;
  lobbyStart: (payload: WithAuth<string>) => void;
}

/**
 * The Socket.io interface for server to client information
 */
export interface ServerToClientEvents {
  chatJoined: (payload: ChatInfo) => void;
  chatMoveLog: (payload: ChatMoveLogPayload) => void;
  chatNewMessage: (payload: ChatNewMessagePayload) => void;
  chatUserJoined: (payload: ChatUserJoinedPayload) => void;
  chatUserLeft: (payload: ChatUserLeftPayload) => void;
  friendRequestReceived: (request: FriendRequest) => void;
  friendRequestUpdated: (request: FriendRequest) => void;
  gamePlayersUpdated: (payload: SafeUserInfo[]) => void;
  gameScoresUpdated: (payload: GameScoresPayload) => void;
  gameStateUpdated: (payload: TaggedGameView & { forPlayer: boolean }) => void;
  gameWatched: (payload: GamePlayInfo) => void;
  dmJoined: (payload: DirectChatInfo) => void;
  dmNewMessage: (payload: DmNewMessagePayload) => void;
  lobbyUpdated: (payload: LobbyInfo) => void;
  lobbyStarted: (payload: { lobbyId: string; gameId: string }) => void;
  userBlocked: (payload: SafeUserInfo) => void;
  userUnblocked: (payload: SafeUserInfo) => void;
  friendRemoved: (removedBy: SafeUserInfo) => void;
  dmUnreadNotification: (payload: { chatId: string; lastMessageAt: Date }) => void;
}
