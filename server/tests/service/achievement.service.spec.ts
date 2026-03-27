import { describe, expect, it } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { getUserBadgesByUsername } from "../../src/services/achievement.service.ts";
import { createGame, joinGame, startGame, updateGame } from "../../src/services/game.service.ts";

async function getKnownUser(username: string) {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`Missing expected seed user ${username}`);
  return user;
}

async function completeNimWithUser1Winning() {
  const user1 = await getKnownUser("user1");
  const user2 = await getKnownUser("user2");

  const game = await createGame(user1, "nim", new Date());
  await joinGame(game.gameId, user2);
  await startGame(game.gameId, user1);

  const moves = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let turn = user1;
  for (const move of moves) {
    await updateGame(game.gameId, turn, move);
    turn = turn.userId === user1.userId ? user2 : user1;
  }
}

describe("achievement badges", () => {
  it("awards first-game and first-win after a completed game", async () => {
    await completeNimWithUser1Winning();

    const user1Badges = await getUserBadgesByUsername("user1");
    const user2Badges = await getUserBadgesByUsername("user2");

    expect(user1Badges.badges).toEqual(expect.arrayContaining(["first-game", "first-win"]));
    expect(user2Badges.badges).toEqual(expect.arrayContaining(["first-game"]));
    expect(user2Badges.badges).not.toContain("first-win");
  });

  it("awards nim-master-3-wins after three nim victories", async () => {
    await completeNimWithUser1Winning();
    await completeNimWithUser1Winning();
    await completeNimWithUser1Winning();

    const user1Badges = await getUserBadgesByUsername("user1");
    expect(user1Badges.badges).toContain("nim-master-3-wins");
  });
});
