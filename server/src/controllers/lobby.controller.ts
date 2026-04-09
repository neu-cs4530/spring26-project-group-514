import {
  withAuth,
  zCreateLobbyPayload,
  zInvitePlayerPayload,
  zRemovePlayerPayload,
  zJoinLobbyByCodePayload,
  zLobbySettingsPayload,
  type LobbyInfo,
} from "@gamenite/shared";
import { type GameServer, type RestAPI, type SocketAPI } from "../types.ts";
import { checkAuth, enforceAuth } from "../services/auth.service.ts";
import {
  createLobby,
  declineInvite,
  getLobbyById,
  getInvitedLobbies,
  getPublicLobbies,
  invitePlayer,
  joinLobby,
  joinLobbyByCode,
  leaveLobby,
  markLobbyStarted,
  removePlayer,
  startLobby,
  updateLobbySettings,
} from "../services/lobby.service.ts";
import { createGame, joinGame, startGame } from "../services/game.service.ts";
import { maybeStartGameTimer } from "./gameTimer.ts";
import { populateSafeUserInfo } from "../services/user.service.ts";
import { z } from "zod";
import { logSocketError } from "./socket.controller.ts";

function parseEmptyPayload(body: unknown) {
  return withAuth(z.object({})).safeParse(body);
}

async function createGameFromLobby(
  io: GameServer | null,
  lobbyId: string,
  host: { userId: string; username: string },
) {
  const { type, playerIds, timerSeconds, isPrivate } = await startLobby(lobbyId, host);
  const game = await createGame(host, type, new Date(), timerSeconds, isPrivate);

  for (const playerId of playerIds) {
    if (playerId === host.userId) continue;
    const player = await populateSafeUserInfo(playerId);
    await joinGame(game.gameId, { userId: playerId, username: player.username });
  }

  await startGame(game.gameId, host);
  await markLobbyStarted(lobbyId, game.gameId);

  if (io) {
    io.to(lobbyId).emit("lobbyStarted", { lobbyId, gameId: game.gameId });
    await maybeStartGameTimer(io, game.gameId);
  }
  return game.gameId;
}

function sendLobbyUpdate(io: GameServer, lobbyId: string, lobby: LobbyInfo) {
  io.to(lobbyId).emit("lobbyUpdated", lobby);
}

/** POST /api/lobby/create */
export const postCreate: RestAPI<LobbyInfo> = async (req, res) => {
  const body = withAuth(zCreateLobbyPayload).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  const lobby = await createLobby(
    user,
    body.data.payload.type,
    body.data.payload.isPrivate,
    new Date(),
  );
  res.send(lobby);
};

/** GET /api/lobby/list */
export const getList: RestAPI<LobbyInfo[]> = async (_req, res) => {
  res.send(await getPublicLobbies());
};

/** POST /api/lobby/invited */
export const postInvited: RestAPI<LobbyInfo[]> = async (req, res) => {
  const body = parseEmptyPayload(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getInvitedLobbies(user));
};

/** GET /api/lobby/:id */
export const getById: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const lobby = await getLobbyById(req.params.id);
  if (!lobby) {
    res.status(404).send({ error: "Lobby not found" });
    return;
  }
  res.send(lobby);
};

/** POST /api/lobby/:id/invite */
export const postInvite: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zInvitePlayerPayload).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  try {
    const lobby = await invitePlayer(req.params.id, user, body.data.payload.username);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/join */
export const postJoin =
  (io: GameServer): RestAPI<LobbyInfo, { id: string }> =>
  async (req, res) => {
    const body = parseEmptyPayload(req.body);
    if (body.error) {
      res.status(400).send({ error: "Poorly-formed request" });
      return;
    }
    const user = await checkAuth(body.data.auth);
    if (!user) {
      res.status(403).send({ error: "Invalid credentials" });
      return;
    }
    try {
      const lobby = await joinLobby(req.params.id, user);
      sendLobbyUpdate(io, req.params.id, lobby);
      res.send(lobby);
    } catch (err) {
      res.status(400).send({ error: (err as Error).message });
    }
  };

/** POST /api/lobby/join-by-code */
export const postJoinByCode =
  (io: GameServer): RestAPI<LobbyInfo> =>
  async (req, res) => {
    const body = withAuth(zJoinLobbyByCodePayload).safeParse(req.body);
    if (body.error) {
      res.status(400).send({ error: "Poorly-formed request" });
      return;
    }
    const user = await checkAuth(body.data.auth);
    if (!user) {
      res.status(403).send({ error: "Invalid credentials" });
      return;
    }
    try {
      const lobby = await joinLobbyByCode(body.data.payload.code, user);
      sendLobbyUpdate(io, lobby.lobbyId, lobby);
      res.send(lobby);
    } catch (err) {
      res.status(400).send({ error: (err as Error).message });
    }
  };

/** POST /api/lobby/:id/leave */
export const postLeave: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = parseEmptyPayload(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  try {
    const lobby = await leaveLobby(req.params.id, user);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/decline */
export const postDecline: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = parseEmptyPayload(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  try {
    const lobby = await declineInvite(req.params.id, user);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/remove */
export const postRemove: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zRemovePlayerPayload).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  try {
    const lobby = await removePlayer(req.params.id, user, body.data.payload.username);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/settings */
export const postSettings: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zLobbySettingsPayload).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  try {
    const lobby = await updateLobbySettings(req.params.id, user, body.data.payload);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/start */
export const postStart: RestAPI<{ gameId: string }, { id: string }> = async (req, res) => {
  const body = parseEmptyPayload(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  try {
    const gameId = await createGameFromLobby(null, req.params.id, user);
    res.send({ gameId });
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** Handle lobby watch (join lobby room and receive the latest state). */
export const socketWatch: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: lobbyId } = withAuth(z.string()).parse(body);
    await enforceAuth(auth);
    const lobby = await getLobbyById(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    await socket.join(lobbyId);
    socket.emit("lobbyUpdated", lobby);
    if (lobby.startedGameId) {
      socket.emit("lobbyStarted", { lobbyId, gameId: lobby.startedGameId });
    }
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle lobby unwatch. */
export const socketUnwatch: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: lobbyId } = withAuth(z.string()).parse(body);
    await enforceAuth(auth);
    await socket.leave(lobbyId);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle lobby join via socket and broadcast updated state. */
export const socketJoin: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: lobbyId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const lobby = await joinLobby(lobbyId, user);
    await socket.join(lobbyId);
    sendLobbyUpdate(io, lobbyId, lobby);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle lobby leave via socket and broadcast updated state. */
export const socketLeave: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: lobbyId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const lobby = await leaveLobby(lobbyId, user);
    sendLobbyUpdate(io, lobbyId, lobby);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle invite action via socket and broadcast updated state. */
export const socketInvitePlayer: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(
      z.object({ lobbyId: z.string(), username: z.string() }),
    ).parse(body);
    const user = await enforceAuth(auth);
    const lobby = await invitePlayer(payload.lobbyId, user, payload.username);
    sendLobbyUpdate(io, payload.lobbyId, lobby);
    io.to(`user:${payload.username}`).emit("lobbyInviteReceived", lobby);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle decline action via socket and broadcast updated state. */
export const socketDeclineInvite: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: lobbyId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const lobby = await declineInvite(lobbyId, user);
    sendLobbyUpdate(io, lobbyId, lobby);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle remove-player action via socket and broadcast updated state. */
export const socketRemovePlayer: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(
      z.object({ lobbyId: z.string(), username: z.string() }),
    ).parse(body);
    const user = await enforceAuth(auth);
    const lobby = await removePlayer(payload.lobbyId, user, payload.username);
    sendLobbyUpdate(io, payload.lobbyId, lobby);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle lobby settings updates via socket and broadcast updated state. */
export const socketUpdateSettings: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload } = withAuth(
      z.object({ lobbyId: z.string(), settings: zLobbySettingsPayload }),
    ).parse(body);
    const user = await enforceAuth(auth);
    const lobby = await updateLobbySettings(payload.lobbyId, user, payload.settings);
    sendLobbyUpdate(io, payload.lobbyId, lobby);
  } catch (err) {
    logSocketError(socket, err);
  }
};

/** Handle lobby start via socket, creating and starting the linked game. */
export const socketStart: SocketAPI = (socket, io) => async (body) => {
  let lobbyId: string | undefined;
  try {
    const parsed = withAuth(z.string()).parse(body);
    lobbyId = parsed.payload;
    const user = await enforceAuth(parsed.auth);
    await createGameFromLobby(io, lobbyId, user);
  } catch (err) {
    logSocketError(socket, err);
    if (lobbyId && err instanceof Error) {
      socket.emit("lobbyError", { lobbyId, error: err.message });
    }
  }
};
