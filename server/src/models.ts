import type { AchievementBadge, GameKey } from "@gamenite/shared";

/**
 * Record identifiers used to look up keys in a database. This type
 * abbreviation is intended to suggest that the key should be a randomly
 * generated unique ID.
 */
export type RecordId = string;

/**
 * Actual JavaScript Date objects can't necessarily be stored in a database;
 * this type indicates that the string should be the result of taking a Date
 * object and turning it to a string with the Date.toISOString() method.
 */
export type DateISO = string;

/**
 * Represents a user's authorization record in the database.
 * - `user`: the user ID of the corresponding User model
 * - `password`: the password for this user
 */
export interface AuthRecord {
  userId: RecordId; // References User models
  password: string;
}

/**
 * Represents a chat document in the database.
 * - `messages`: the ordered list of messages in the chat
 * - `moveLog`: the ordered list of move log entries for this chat
 * - `createdAt`: when the chat was created
 */
export interface ChatRecord {
  messages: RecordId[]; // References Message models
  moveLog: MoveLogEntry[];
  createdAt: DateISO;
}

/**
 * Represents a game move log entry stored in a chat.
 * - `moveDescription`: human-readable description of the move
 * - `userId`: the user who made the move
 * - `createdAt`: when the move was made
 */
export interface MoveLogEntry {
  moveDescription: string;
  userId: RecordId;
  createdAt: DateISO;
}

/**
 * Represents a comment in the database.
 * - `text`: comment contents
 * - `createdBy`: username of the commenter
 * - `createdAt`: when the comment was made
 * - `editedAt`: when the comment was last modified
 */
export interface CommentRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
  editedAt?: DateISO;
}

/**
 * Represents a game document in the database.
 * - `type`: picks which game this is
 * - `state`: absent if the game hasn't started, or the id for the game's state
 * - `chat`: id for the game's chat
 * - `players`: active players for the game
 * - `createdAt`: when the game was created
 * - `createdBy`: username of the person who created the game
 */
export interface GameRecord {
  type: GameKey;
  state?: unknown;
  done: boolean;
  chat: RecordId; // References Chat records
  players: RecordId[]; // References User records
  createdAt: DateISO;
  createdBy: RecordId; // References User records
}

export interface GameHistoryRecord {
  type: GameKey;
  state: unknown;
  players: RecordId[]; // References User records
  endedAt: DateISO;
}

/**
 * Represents a message in the database.
 * - `text`: message contents
 * - `createdBy`: username of message sender
 * - `createdAt`: when the message was sent
 */
export interface MessageRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
}

/**
 * Represents a forum post as it's stored in the database.
 * - `title`: post title
 * - `text`: post contents
 * - `createdAt`: when the thread was posted
 * - `createdBy`: username of OP
 * - `comments`: replies to the post
 */
export interface ThreadRecord {
  title: string;
  text: string;
  createdAt: DateISO;
  createdBy: RecordId; // References User records
  comments: RecordId[]; // References Comment records
}

/**
 * Represents a user document in the database.
 * - `password`: user's password
 * - `display`: A display name
 * - `createdAt`: when this user registered.
 * - `friends`: user's friends id
 * - `friendInReqs`: user's incoming friend requests
 * - `friendOutReqs`: user's outgoing friend requests
 * - `directChats`: user's direct chats
 * - `blocked`: user's blocked users
 */
export interface UserRecord {
  username: string; // References Auth records
  display: string;
  createdAt: DateISO;
  badges: AchievementBadge[];
  friends: Record<RecordId, true>; // References User records
  friendInReqs: Record<RecordId, RecordId>; // References User records -> FriendRequest records
  friendOutReqs: Record<RecordId, RecordId>; // References User records -> FriendRequest records
  directChats: Record<RecordId, RecordId>; // References User records -> DirectChatSummary records
  blocked: Record<RecordId, true>; // References User records
}

/**
 * Represents a friend request document in the database.
 * - `fromUser`: the id reference to the user record of the user that sent the friend request.
 * - `toUser`: the id reference to the user record of the user that recieved the friend request.
 * - `status`: the status of the request.
 * - `createdAt`: the time the request was sent.
 * - `respondedAt`: the time the request was responded to.
 */
export interface FriendRequestRecord {
  fromUser: RecordId; // References User
  toUser: RecordId; // References User
  status: "pending" | "accepted" | "rejected";
  createdAt: DateISO;
  respondedAt?: DateISO;
}

/**
 * Represents a direct message document in the database.
 * - `participations`: the two people in the dm.
 * - `messages`: the messages sent in the dm.
 * - `createdAt`: time dm created.
 */
export interface DirectChatRecord {
  participants: [RecordId, RecordId]; // Two User IDs
  messages: RecordId[]; // References Message records
  createdAt: DateISO;
}

/**
 * Represents a lobby document in the database.
 * - `type`: which game this lobby is for
 * - `isPrivate`: whether the lobby is hidden from public list
 * - `code`: unique join code for sharing
 * - `createdBy`: user id of the lobby host
 * - `players`: list of players and their invite statuses
 * - `createdAt`: when the lobby was created
 */
/**
 * Represents a player's aggregated stats in the database.
 * - `userId`: the user ID
 * - `username`: the username for display
 * - `wins`: total number of wins
 * - `losses`: total number of losses
 * - `gamesPlayed`: total games played
 * - `winRate`: precomputed win rate (0-1)
 * - `leaderboardOptOut`: whether the user has opted out of the public leaderboard
 * - `lastPlayedAt`: when the user last completed a game
 */
export interface PlayerStatsRecord {
  userId: RecordId;
  username: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  leaderboardOptOut: boolean;
  lastPlayedAt: DateISO;
}

export interface LobbyRecord {
  type: GameKey;
  isPrivate: boolean;
  code: string;
  createdBy: RecordId;
  players: { userId: RecordId; status: "pending" | "joined" | "declined" }[];
  settings: {
    mode: "standard" | "casual";
    difficulty: "normal" | "hard";
    timerSeconds: number | null;
  };
  chatId: RecordId; // References Chat records
  startedGameId?: RecordId; // References Game records
  createdAt: DateISO;
}
