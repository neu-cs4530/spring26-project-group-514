import { withAuth, zCreateLobbyPayload, zInvitePlayerPayload, zRemovePlayerPayload, zJoinLobbyByCodePayload, type LobbyInfo } from "@gamenite/shared";
import { type RestAPI, type SocketAPI, type GameServer } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
  createLobby,
  getLobbyById,
  getPublicLobbies,
  invitePlayer,
  joinLobby,
  joinLobbyByCode,
  leaveLobby,
  removePlayer,
  startLobby,
} from "../services/lobby.service.ts";
import { createGame } from "../services/game.service.ts";
import { z } from "zod";

let _io: GameServer | null = null;
export function setIo(io: GameServer) {
  _io = io;
}

async function broadcastLobbyUpdate(lobbyId: string) {
  if (!_io) return;
  const lobby = await getLobbyById(lobbyId);
  if (lobby) _io.to(lobbyId).emit("lobbyUpdated", lobby);
}

/** POST /api/lobby/create */
export const postCreate: RestAPI<LobbyInfo> = async (req, res) => {
  const body = withAuth(zCreateLobbyPayload).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  const lobby = await createLobby(user, body.data.payload.type, body.data.payload.isPrivate, new Date());
  res.send(lobby);
};

/** GET /api/lobby/list */
export const getList: RestAPI<LobbyInfo[]> = async (_req, res) => {
  res.send(await getPublicLobbies());
};

/** GET /api/lobby/:id */
export const getById: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const lobby = await getLobbyById(req.params.id);
  if (!lobby) { res.status(404).send({ error: "Lobby not found" }); return; }
  res.send(lobby);
};

/** POST /api/lobby/:id/invite */
export const postInvite: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zInvitePlayerPayload).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  try {
    const lobby = await invitePlayer(req.params.id, user, body.data.payload.username);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/join */
export const postJoin: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  try {
    const lobby = await joinLobby(req.params.id, user);
    await broadcastLobbyUpdate(req.params.id);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/join-by-code */
export const postJoinByCode: RestAPI<LobbyInfo> = async (req, res) => {
  const body = withAuth(zJoinLobbyByCodePayload).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  try {
    const lobby = await joinLobbyByCode(body.data.payload.code, user);
    await broadcastLobbyUpdate(lobby.lobbyId);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/leave */
export const postLeave: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  try {
    const lobby = await leaveLobby(req.params.id, user);
    await broadcastLobbyUpdate(req.params.id);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/remove */
export const postRemove: RestAPI<LobbyInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zRemovePlayerPayload).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  try {
    const lobby = await removePlayer(req.params.id, user, body.data.payload.username);
    await broadcastLobbyUpdate(req.params.id);
    res.send(lobby);
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** POST /api/lobby/:id/start */
export const postStart: RestAPI<{ gameId: string }, { id: string }> = async (req, res) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (body.error) { res.status(400).send({ error: "Poorly-formed request" }); return; }
  const user = await checkAuth(body.data.auth);
  if (!user) { res.status(403).send({ error: "Invalid credentials" }); return; }
  try {
    const { type, playerIds } = await startLobby(req.params.id, user);
    // Create the actual game, starting with the host
    const game = await createGame(user, type, new Date());
    res.send({ gameId: game.gameId });
  } catch (err) {
    res.status(400).send({ error: (err as Error).message });
  }
};

/** Socket: join a lobby room to receive real-time updates */
export const socketJoinLobby: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: lobbyId } = withAuth(z.string()).parse(body);
    const user = await checkAuth(auth);
    if (!user) return;
    await socket.join(lobbyId);
    const lobby = await getLobbyById(lobbyId);
    if (lobby) socket.emit("lobbyUpdated", lobby);
  } catch (err) {
    console.error(err);
  }
};
