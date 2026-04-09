import { type GameServer, type GameViewUpdates } from "../types.ts";
import { expireGameByTimer, getGameScores, getGameTimer } from "../services/game.service.ts";

const gameTimerIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function clearGameTimer(gameId: string) {
  const timer = gameTimerIntervals.get(gameId);
  if (timer) {
    clearInterval(timer);
    gameTimerIntervals.delete(gameId);
  }
}

function sendViewUpdates(io: GameServer, gameId: string, updates: GameViewUpdates) {
  io.to(gameId).emit("gameStateUpdated", { ...updates.watchers, forPlayer: false });
  for (const { userId, view } of updates.players) {
    io.to(`${gameId}-${userId}`).emit("gameStateUpdated", { ...view, forPlayer: true });
  }
}

async function sendScoreUpdates(io: GameServer, gameId: string) {
  io.to(gameId).emit("gameScoresUpdated", await getGameScores(gameId));
}

export async function maybeStartGameTimer(io: GameServer, gameId: string) {
  clearGameTimer(gameId);

  const initial = await getGameTimer(gameId);
  if (!initial || !initial.isRunning) return;

  io.to(gameId).emit("gameTimerStarted", initial);
  io.to(gameId).emit("gameTimerUpdated", initial);

  const interval = setInterval(async () => {
    const payload = await getGameTimer(gameId);
    if (!payload) {
      clearGameTimer(gameId);
      return;
    }

    io.to(gameId).emit("gameTimerUpdated", payload);

    if (payload.remainingSeconds <= 0) {
      clearGameTimer(gameId);
      const expired = await expireGameByTimer(gameId);
      if (expired) {
        sendViewUpdates(io, gameId, expired.views);
        await sendScoreUpdates(io, gameId);
      }
    }
  }, 1000);

  gameTimerIntervals.set(gameId, interval);
}
