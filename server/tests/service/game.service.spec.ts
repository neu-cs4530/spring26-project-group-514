import { describe, expect, it } from "vitest";
import { getGameScores, getGames, updateGame } from "../../src/services/game.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";

describe("getGameScores", () => {
  it("returns current scores for an active guess game", async () => {
    const activeGuess = (await getGames()).find(
      (game) => game.type === "guess" && game.status === "active",
    );
    expect(activeGuess).toBeTruthy();

    const payload = await getGameScores(activeGuess!.gameId);
    expect(payload).toStrictEqual({
      gameId: activeGuess!.gameId,
      scores: [
        { playerIndex: 0, score: 0 },
        { playerIndex: 1, score: 1 },
        { playerIndex: 2, score: 1 },
        { playerIndex: 3, score: 0 },
      ],
    });
  });

  it("updates scores after a move", async () => {
    const activeGuess = (await getGames()).find(
      (game) => game.type === "guess" && game.status === "active",
    );
    expect(activeGuess).toBeTruthy();

    const player = await getUserByUsername("user1");
    expect(player).toBeTruthy();

    await updateGame(activeGuess!.gameId, player!, 43);

    const payload = await getGameScores(activeGuess!.gameId);
    expect(payload.scores).toStrictEqual([
      { playerIndex: 0, score: 1 },
      { playerIndex: 1, score: 1 },
      { playerIndex: 2, score: 1 },
      { playerIndex: 3, score: 0 },
    ]);
  });

  it("returns winner scoring for a completed nim game", async () => {
    const doneNim = (await getGames()).find(
      (game) => game.type === "nim" && game.status === "done",
    );
    expect(doneNim).toBeTruthy();

    const payload = await getGameScores(doneNim!.gameId);
    expect(payload.scores).toStrictEqual([
      { playerIndex: 0, score: 0 },
      { playerIndex: 1, score: 1 },
    ]);
  });
});
