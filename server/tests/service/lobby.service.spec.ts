//TODO: Rename this to lobby.service.spec.ts

import { describe, expect, it } from "vitest";
import { createGame, getGames } from "../../src/services/game.service.ts";
import {
  createLobby,
  invitePlayer,
  joinLobby,
  startLobby,
} from "../../src/services/lobby.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";

describe("startLobby returns isPrivate", () => {
  it("returns isPrivate: true for a private lobby", async () => {
    const host = await getUserByUsername("user1");
    expect(host).toBeTruthy();

    const lobby = await createLobby(host!, "nim", true, new Date());
    const guest = await getUserByUsername("user2");
    expect(guest).toBeTruthy();

    await invitePlayer(lobby.lobbyId, host!, "user2");
    await joinLobby(lobby.lobbyId, guest!);

    const result = await startLobby(lobby.lobbyId, host!);
    expect(result).toHaveProperty("isPrivate", true);
  });

  it("returns isPrivate: false for a public lobby", async () => {
    const host = await getUserByUsername("user1");
    expect(host).toBeTruthy();

    const lobby = await createLobby(host!, "nim", false, new Date());
    const guest = await getUserByUsername("user2");
    expect(guest).toBeTruthy();

    await joinLobby(lobby.lobbyId, guest!);

    const result = await startLobby(lobby.lobbyId, host!);
    expect(result).toHaveProperty("isPrivate", false);
  });
});

describe("getGames excludes private games", () => {
  it("does not include private games in the list", async () => {
    const host = await getUserByUsername("user1");
    expect(host).toBeTruthy();

    // Create a private game directly (simulating what createGameFromLobby will do)
    const privateGame = await createGame(host!, "nim", new Date(), null, true);
    const publicGame = await createGame(host!, "nim", new Date(), null, false);

    const games = await getGames();
    const gameIds = games.map((g) => g.gameId);

    expect(gameIds).not.toContain(privateGame.gameId);
    expect(gameIds).toContain(publicGame.gameId);
  });
});
