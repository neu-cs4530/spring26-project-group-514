import { describe, expect, it } from "vitest";
import { createGame, getGames } from "../../src/services/game.service.ts";
import {
  createLobby,
  declineInvite,
  getLobbyByCode,
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

    const privateGame = await createGame(host!, "nim", new Date(), null, true);
    const publicGame = await createGame(host!, "nim", new Date(), null, false);

    const games = await getGames();
    const gameIds = games.map((g) => g.gameId);

    expect(gameIds).not.toContain(privateGame.gameId);
    expect(gameIds).toContain(publicGame.gameId);
  });
});

describe("getLobbyById", () => {
  it("returns null for a non-existent lobby", async () => {
    const result = await getLobbyById("nonexistent-id");
    expect(result).toBeNull();
  });

  it("returns the lobby for a valid id", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    const result = await getLobbyById(lobby.lobbyId);
    expect(result).not.toBeNull();
    expect(result!.lobbyId).toBe(lobby.lobbyId);
  });
});

describe("getLobbyByCode", () => {
  it("returns the lobby matching the code among multiple lobbies", async () => {
    const host = (await getUserByUsername("user1"))!;
    // Create multiple lobbies so the loop iterates past non-matching codes
    await createLobby(host, "nim", false, new Date());
    const target = await createLobby(host, "guess", false, new Date());
    await createLobby(host, "nim", true, new Date());

    const found = await getLobbyByCode(target.code);
    expect(found).not.toBeNull();
    expect(found!.lobbyId).toBe(target.lobbyId);
  });

  it("returns null when no lobby matches the code", async () => {
    const found = await getLobbyByCode("ZZZZZZZZ");
    expect(found).toBeNull();
  });
});

describe("joinLobbyByCode", () => {
  it("joins a lobby by its code among multiple lobbies", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    // Create multiple lobbies so the loop iterates past non-matching codes
    await createLobby(host, "nim", true, new Date());
    const target = await createLobby(host, "nim", false, new Date());
    await createLobby(host, "guess", false, new Date());

    const result = await joinLobbyByCode(target.code, user2);
    expect(result.lobbyId).toBe(target.lobbyId);
    const playerUsernames = result.players.map((p) => p.user.username);
    expect(playerUsernames).toContain("user2");
  });

  it("throws when no lobby matches the code", async () => {
    const user2 = (await getUserByUsername("user2"))!;
    await expect(joinLobbyByCode("NOTACODE", user2)).rejects.toThrow(
      "No lobby found with code NOTACODE",
    );
  });
});

describe("getPublicLobbies", () => {
  it("returns only public non-started lobbies sorted by newest first", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;

    const olderLobby = await createLobby(host, "nim", false, new Date("2025-01-01"));
    const newerLobby = await createLobby(host, "guess", false, new Date("2025-06-01"));
    await createLobby(host, "nim", true, new Date()); // private lobby

    // Create and start a public lobby
    const startedLobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(startedLobby.lobbyId, user2);
    await startLobby(startedLobby.lobbyId, host);

    const lobbies = await getPublicLobbies();
    const lobbyIds = lobbies.map((l) => l.lobbyId);

    expect(lobbyIds).toContain(olderLobby.lobbyId);
    expect(lobbyIds).toContain(newerLobby.lobbyId);
    expect(lobbyIds).not.toContain(startedLobby.lobbyId);

    // Verify sorted newest first
    const olderIdx = lobbyIds.indexOf(olderLobby.lobbyId);
    const newerIdx = lobbyIds.indexOf(newerLobby.lobbyId);
    expect(newerIdx).toBeLessThan(olderIdx);
  });
});

describe("getInvitedLobbies", () => {
  it("returns only pending invites sorted by newest first", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;

    const olderLobby = await createLobby(host, "nim", true, new Date("2025-01-01"));
    const newerLobby = await createLobby(host, "nim", true, new Date("2025-06-01"));
    const joinedLobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(olderLobby.lobbyId, host, "user2");
    await invitePlayer(newerLobby.lobbyId, host, "user2");
    await invitePlayer(joinedLobby.lobbyId, host, "user2");

    // Accept joinedLobby invite so it's no longer pending
    await joinLobby(joinedLobby.lobbyId, user2);

    const invites = await getInvitedLobbies(user2);
    const ids = invites.map((l) => l.lobbyId);

    expect(ids).toContain(olderLobby.lobbyId);
    expect(ids).toContain(newerLobby.lobbyId);
    expect(ids).not.toContain(joinedLobby.lobbyId);

    // Verify sorted newest first
    const olderIdx = ids.indexOf(olderLobby.lobbyId);
    const newerIdx = ids.indexOf(newerLobby.lobbyId);
    expect(newerIdx).toBeLessThan(olderIdx);
  });

  it("excludes started lobbies from invites", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const user3 = (await getUserByUsername("user3"))!;

    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");
    await invitePlayer(lobby.lobbyId, host, "user3");
    await joinLobby(lobby.lobbyId, user2);
    await startLobby(lobby.lobbyId, host);

    const invites = await getInvitedLobbies(user3);
    const ids = invites.map((l) => l.lobbyId);
    expect(ids).not.toContain(lobby.lobbyId);
  });
});

describe("leaveLobby", () => {
  it("removes the user from the lobby", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    const result = await leaveLobby(lobby.lobbyId, user2);
    const playerUsernames = result.players.map((p) => p.user.username);
    expect(playerUsernames).not.toContain("user2");
  });

  it("throws when lobby does not exist", async () => {
    const user2 = (await getUserByUsername("user2"))!;
    await expect(leaveLobby("nonexistent", user2)).rejects.toThrow("Lobby nonexistent not found");
  });

  it("throws when host tries to leave", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await expect(leaveLobby(lobby.lobbyId, host)).rejects.toThrow(
      "Host cannot leave their own lobby",
    );
  });
});

describe("declineInvite", () => {
  it("throws when user is not invited", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", true, new Date());

    await expect(declineInvite(lobby.lobbyId, user2)).rejects.toThrow(
      "You are not invited to this lobby",
    );
  });

  it("throws when lobby does not exist", async () => {
    const user2 = (await getUserByUsername("user2"))!;
    await expect(declineInvite("nonexistent", user2)).rejects.toThrow(
      "Lobby nonexistent not found",
    );
  });
});

describe("removePlayer", () => {
  it("throws when trying to remove the host", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());
    await expect(removePlayer(lobby.lobbyId, host, "user1")).rejects.toThrow(
      "Cannot remove the host",
    );
  });

  it("throws when target user does not exist", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", true, new Date());
    await expect(removePlayer(lobby.lobbyId, host, "noSuchUser")).rejects.toThrow(
      "User noSuchUser not found",
    );
  });

  it("throws when lobby does not exist", async () => {
    const host = (await getUserByUsername("user1"))!;
    await expect(removePlayer("nonexistent", host, "user2")).rejects.toThrow(
      "Lobby nonexistent not found",
    );
  });

  it("throws when non-host tries to remove", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await expect(removePlayer(lobby.lobbyId, user2, "user1")).rejects.toThrow(
      "Only the host can remove players",
    );
  });
});

describe("invitePlayer", () => {
  it("throws when lobby does not exist", async () => {
    const host = (await getUserByUsername("user1"))!;
    await expect(invitePlayer("nonexistent", host, "user2")).rejects.toThrow(
      "Lobby nonexistent not found",
    );
  });

  it("throws when non-host invites", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await expect(invitePlayer(lobby.lobbyId, user2, "user3")).rejects.toThrow(
      "Only the host can invite players",
    );
  });
});

describe("joinLobby", () => {
  it("throws when lobby does not exist", async () => {
    const user2 = (await getUserByUsername("user2"))!;
    await expect(joinLobby("nonexistent", user2)).rejects.toThrow(
      "Lobby nonexistent not found",
    );
  });
});

describe("updateLobbySettings", () => {
  it("throws when lobby does not exist", async () => {
    const host = (await getUserByUsername("user1"))!;
    await expect(
      updateLobbySettings("nonexistent", host, {
        mode: "standard",
        difficulty: "normal",
        timerSeconds: null,
      }),
    ).rejects.toThrow("Lobby nonexistent not found");
  });

  it("throws when non-host updates settings", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await expect(
      updateLobbySettings(lobby.lobbyId, user2, {
        mode: "casual",
        difficulty: "hard",
        timerSeconds: null,
      }),
    ).rejects.toThrow("Only the host can update settings");
  });
});

describe("markLobbyStarted", () => {
  it("stores the game id on the lobby", async () => {
    const host = (await getUserByUsername("user1"))!;
    const lobby = await createLobby(host, "nim", false, new Date());

    const result = await markLobbyStarted(lobby.lobbyId, "game-123");
    expect(result.startedGameId).toBe("game-123");
  });

  it("throws when lobby does not exist", async () => {
    await expect(markLobbyStarted("nonexistent", "game-123")).rejects.toThrow(
      "Lobby nonexistent not found",
    );
  });
});

describe("startLobby error paths", () => {
  it("throws when lobby does not exist", async () => {
    const host = (await getUserByUsername("user1"))!;
    await expect(startLobby("nonexistent", host)).rejects.toThrow(
      "Lobby nonexistent not found",
    );
  });

  it("throws when non-host tries to start", async () => {
    const host = (await getUserByUsername("user1"))!;
    const user2 = (await getUserByUsername("user2"))!;
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, user2);

    await expect(startLobby(lobby.lobbyId, user2)).rejects.toThrow(
      "Only the host can start the game",
    );
  });
});
