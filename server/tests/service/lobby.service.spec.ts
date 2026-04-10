import { describe, expect, it } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
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
import type { UserWithId } from "../../src/types.ts";

async function getUser(username: string): Promise<UserWithId> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`Missing test user ${username}`);
  return user;
}

describe("createLobby", () => {
  it("creates a private lobby with the host as first joined player", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", true, new Date());

    expect(lobby.type).toBe("nim");
    expect(lobby.isPrivate).toBe(true);
    expect(lobby.code).toBeTruthy();
    expect(lobby.players).toHaveLength(1);
    expect(lobby.players[0].user.username).toBe("user1");
    expect(lobby.players[0].status).toBe("joined");
    expect(lobby.settings).toStrictEqual({
      mode: "standard",
      difficulty: "normal",
      timerSeconds: null,
    });
  });

  it("creates a public lobby", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "guess", false, new Date());

    expect(lobby.isPrivate).toBe(false);
    expect(lobby.type).toBe("guess");
  });
});

describe("getLobbyById / getLobbyByCode", () => {
  it("returns lobby by id", async () => {
    const host = await getUser("user1");
    const created = await createLobby(host, "nim", false, new Date());

    const found = await getLobbyById(created.lobbyId);
    expect(found).toBeTruthy();
    expect(found!.lobbyId).toBe(created.lobbyId);
  });

  it("returns null for nonexistent id", async () => {
    const found = await getLobbyById("nonexistent-id");
    expect(found).toBeNull();
  });

  it("returns lobby by its join code", async () => {
    const host = await getUser("user1");
    const created = await createLobby(host, "nim", false, new Date());

    const found = await getLobbyByCode(created.code);
    expect(found).toBeTruthy();
    expect(found!.lobbyId).toBe(created.lobbyId);
  });

  it("returns null for nonexistent code", async () => {
    const found = await getLobbyByCode("ZZZZZZZZ");
    expect(found).toBeNull();
  });
});

describe("getPublicLobbies", () => {
  it("returns only public, not-started lobbies", async () => {
    const host = await getUser("user1");
    await createLobby(host, "nim", true, new Date());
    const publicLobby = await createLobby(host, "guess", false, new Date());

    const lobbies = await getPublicLobbies();
    expect(lobbies.some((l) => l.lobbyId === publicLobby.lobbyId)).toBe(true);
    expect(lobbies.every((l) => !l.isPrivate)).toBe(true);
  });
});

describe("invitePlayer", () => {
  it("adds a player with pending status", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", true, new Date());

    const updated = await invitePlayer(lobby.lobbyId, host, "user2");
    const user2Entry = updated.players.find((p) => p.user.username === "user2");
    expect(user2Entry).toBeTruthy();
    expect(user2Entry!.status).toBe("pending");
  });

  it("rejects invite from non-host", async () => {
    const host = await getUser("user1");
    const nonHost = await getUser("user2");
    const lobby = await createLobby(host, "nim", true, new Date());

    await expect(invitePlayer(lobby.lobbyId, nonHost, "user3")).rejects.toThrow(
      "Only the host can invite players",
    );
  });

  it("rejects inviting a user already in the lobby", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    await expect(invitePlayer(lobby.lobbyId, host, "user2")).rejects.toThrow(
      "already in this lobby",
    );
  });

  it("rejects inviting a nonexistent user", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", true, new Date());

    await expect(invitePlayer(lobby.lobbyId, host, "ghost_user")).rejects.toThrow("not found");
  });
});

describe("joinLobby", () => {
  it("transitions pending invite to joined", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    const updated = await joinLobby(lobby.lobbyId, guest);
    const user2Entry = updated.players.find((p) => p.user.username === "user2");
    expect(user2Entry!.status).toBe("joined");
  });

  it("allows direct join for a public lobby", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());

    const updated = await joinLobby(lobby.lobbyId, guest);
    expect(updated.players).toHaveLength(2);
    expect(updated.players[1].user.username).toBe("user2");
    expect(updated.players[1].status).toBe("joined");
  });

  it("rejects direct join for a private lobby without invite", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", true, new Date());

    await expect(joinLobby(lobby.lobbyId, guest)).rejects.toThrow(
      "Cannot join a private lobby without an invite",
    );
  });

  it("rejects join on a nonexistent lobby", async () => {
    const guest = await getUser("user2");
    await expect(joinLobby("nonexistent-id", guest)).rejects.toThrow("not found");
  });
});

describe("joinLobbyByCode", () => {
  it("joins a public lobby by code", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());

    const updated = await joinLobbyByCode(lobby.code, guest);
    expect(updated.players).toHaveLength(2);
    expect(updated.players[1].user.username).toBe("user2");
  });

  it("throws for invalid code", async () => {
    const guest = await getUser("user2");
    await expect(joinLobbyByCode("INVALIDCODE", guest)).rejects.toThrow("No lobby found");
  });
});

describe("leaveLobby", () => {
  it("removes a joined player from the lobby", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);

    const updated = await leaveLobby(lobby.lobbyId, guest);
    expect(updated.players).toHaveLength(1);
    expect(updated.players[0].user.username).toBe("user1");
  });

  it("prevents the host from leaving", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", false, new Date());

    await expect(leaveLobby(lobby.lobbyId, host)).rejects.toThrow(
      "Host cannot leave their own lobby",
    );
  });

  it("rejects leave on a nonexistent lobby", async () => {
    const guest = await getUser("user2");
    await expect(leaveLobby("nonexistent-id", guest)).rejects.toThrow("not found");
  });
});

describe("declineInvite", () => {
  it("sets invite status to declined", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    const updated = await declineInvite(lobby.lobbyId, guest);
    const user2Entry = updated.players.find((p) => p.user.username === "user2");
    expect(user2Entry!.status).toBe("declined");
  });

  it("rejects decline from user not in the lobby", async () => {
    const host = await getUser("user1");
    const stranger = await getUser("user3");
    const lobby = await createLobby(host, "nim", true, new Date());

    await expect(declineInvite(lobby.lobbyId, stranger)).rejects.toThrow(
      "You are not invited to this lobby",
    );
  });
});

describe("removePlayer", () => {
  it("removes an invited player", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");

    const updated = await removePlayer(lobby.lobbyId, host, "user2");
    expect(updated.players).toHaveLength(1);
  });

  it("rejects removal by non-host", async () => {
    const host = await getUser("user1");
    const nonHost = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, nonHost);

    await expect(removePlayer(lobby.lobbyId, nonHost, "user1")).rejects.toThrow(
      "Only the host can remove players",
    );
  });

  it("rejects removing the host", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", false, new Date());

    await expect(removePlayer(lobby.lobbyId, host, "user1")).rejects.toThrow(
      "Cannot remove the host",
    );
  });
});

describe("updateLobbySettings", () => {
  it("updates settings when called by host", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", false, new Date());

    const updated = await updateLobbySettings(lobby.lobbyId, host, {
      mode: "casual",
      difficulty: "hard",
      timerSeconds: 120,
    });

    expect(updated.settings).toStrictEqual({
      mode: "casual",
      difficulty: "hard",
      timerSeconds: 120,
    });
  });

  it("rejects settings update from non-host", async () => {
    const host = await getUser("user1");
    const nonHost = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());

    await expect(
      updateLobbySettings(lobby.lobbyId, nonHost, {
        mode: "casual",
        difficulty: "normal",
        timerSeconds: null,
      }),
    ).rejects.toThrow("Only the host can update settings");
  });
});

describe("getInvitedLobbies", () => {
  it("returns lobbies where user has pending invite", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");

    const lobby1 = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby1.lobbyId, host, "user2");

    // lobby2: user2 already joined — should NOT appear
    const lobby2 = await createLobby(host, "guess", true, new Date());
    await invitePlayer(lobby2.lobbyId, host, "user2");
    await joinLobby(lobby2.lobbyId, guest);

    const invited = await getInvitedLobbies(guest);
    expect(invited).toHaveLength(1);
    expect(invited[0].lobbyId).toBe(lobby1.lobbyId);
  });

  it("returns empty for user with no invites", async () => {
    const user = await getUser("user3");
    const invited = await getInvitedLobbies(user);
    expect(invited).toStrictEqual([]);
  });
});

describe("startLobby", () => {
  it("returns game type, player ids, timer, and privacy from lobby", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");
    await joinLobby(lobby.lobbyId, guest);

    await updateLobbySettings(lobby.lobbyId, host, {
      mode: "standard",
      difficulty: "normal",
      timerSeconds: 60,
    });

    const result = await startLobby(lobby.lobbyId, host);
    expect(result.type).toBe("nim");
    expect(result.isPrivate).toBe(true);
    expect(result.timerSeconds).toBe(60);
    expect(result.playerIds).toHaveLength(2);
  });

  it("rejects start from non-host", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);

    await expect(startLobby(lobby.lobbyId, guest)).rejects.toThrow(
      "Only the host can start the game",
    );
  });

  it("rejects start with too few players", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", false, new Date());

    await expect(startLobby(lobby.lobbyId, host)).rejects.toThrow("Min player count not met");
  });

  it("rejects double start", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);

    await startLobby(lobby.lobbyId, host);
    await expect(startLobby(lobby.lobbyId, host)).rejects.toThrow("Lobby already started");
  });

  it("only counts joined players, not pending or declined", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const decliner = await getUser("user3");

    const lobby = await createLobby(host, "nim", true, new Date());
    await invitePlayer(lobby.lobbyId, host, "user2");
    await invitePlayer(lobby.lobbyId, host, "user3");
    await joinLobby(lobby.lobbyId, guest);
    await declineInvite(lobby.lobbyId, decliner);

    const result = await startLobby(lobby.lobbyId, host);
    expect(result.playerIds).toHaveLength(2);
  });

  it("returns isPrivate: true for a private lobby", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", true, new Date());
    const guest = await getUser("user2");
    await invitePlayer(lobby.lobbyId, host, "user2");
    await joinLobby(lobby.lobbyId, guest);

    const result = await startLobby(lobby.lobbyId, host);
    expect(result).toHaveProperty("isPrivate", true);
  });

  it("returns isPrivate: false for a public lobby", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", false, new Date());
    const guest = await getUser("user2");
    await joinLobby(lobby.lobbyId, guest);

    const result = await startLobby(lobby.lobbyId, host);
    expect(result).toHaveProperty("isPrivate", false);
  });
});

describe("markLobbyStarted", () => {
  it("stores the game id on the lobby", async () => {
    const host = await getUser("user1");
    const lobby = await createLobby(host, "nim", false, new Date());

    const updated = await markLobbyStarted(lobby.lobbyId, "game-123");
    expect(updated.startedGameId).toBe("game-123");
  });
});

describe("operations on started lobbies are rejected", () => {
  it("rejects join after lobby started", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const joiner = await getUser("user3");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);
    await startLobby(lobby.lobbyId, host);

    await expect(joinLobby(lobby.lobbyId, joiner)).rejects.toThrow("Lobby already started");
  });

  it("rejects leave after lobby started", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);
    await startLobby(lobby.lobbyId, host);

    await expect(leaveLobby(lobby.lobbyId, guest)).rejects.toThrow("Lobby already started");
  });

  it("rejects settings update after lobby started", async () => {
    const host = await getUser("user1");
    const guest = await getUser("user2");
    const lobby = await createLobby(host, "nim", false, new Date());
    await joinLobby(lobby.lobbyId, guest);
    await startLobby(lobby.lobbyId, host);

    await expect(
      updateLobbySettings(lobby.lobbyId, host, {
        mode: "casual",
        difficulty: "normal",
        timerSeconds: null,
      }),
    ).rejects.toThrow("Lobby already started");
  });
});

describe("getGames excludes private games", () => {
  it("does not include private games in the list", async () => {
    const host = await getUser("user1");
    const privateGame = await createGame(host, "nim", new Date(), null, true);
    const publicGame = await createGame(host, "nim", new Date(), null, false);

    const games = await getGames();
    const gameIds = games.map((g) => g.gameId);

    expect(gameIds).not.toContain(privateGame.gameId);
    expect(gameIds).toContain(publicGame.gameId);
  });
});
