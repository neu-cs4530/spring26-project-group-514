import { useEffect, useState } from "react";
import useAuth from "./useAuth.ts";
import type {
  GamePlayInfo,
  GamePlayerScore,
  GameScoresPayload,
  GameTimerPayload,
  SafeUserInfo,
  TaggedGameView,
} from "@gamenite/shared";
import useLoginContext from "./useLoginContext.ts";

/**
 * Custom hook to manage socket connection for a game
 * @throws if outside a LoginContext
 * @returns an object containing:
 * - `hasWatched`: Boolean that goes from false to true once the server has
 *   acknowledged the socket connection request
 * - `players`: The current list of game players.
 * - `userPlayerIndex`: The index of the current user in the `players` array,
 *   or null if the user is not a player
 * - `view`: The current game view for this user
 * - `scores`: The latest in-game score list for all players
 * - `joinGame`: Joins the game (if not started)
 * - `startGame`: Start the game (once joined)
 */
export default function useSocketsForGame(gameId: string, initialPlayers: SafeUserInfo[]) {
  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const [view, setView] = useState<null | TaggedGameView>(null);
  const [scores, setScores] = useState<GamePlayerScore[]>([]);
  const [timer, setTimer] = useState<GameTimerPayload | null>(null);
  const [timerStartedSignal, setTimerStartedSignal] = useState(0);
  const [hasWatched, setHasWatched] = useState<boolean>(false);
  const [players, setPlayers] = useState<SafeUserInfo[]>(initialPlayers);
  const userPlayerIndex = players.findIndex(({ username }) => username === user.username);

  useEffect(() => {
    const handleWatched = (game: GamePlayInfo) => {
      if (game.gameId !== gameId) return;
      socket.off("gameWatched", handleWatched);
      setHasWatched(true);
      setPlayers(game.players);
      setView(game.view);
    };

    const handlePlayersUpdated = (newPlayers: SafeUserInfo[]) => {
      setPlayers(newPlayers);
    };

    const handleStateUpdated = (view: TaggedGameView & { forPlayer: boolean }) => {
      if (!view) return;
      if (userPlayerIndex >= 0 && !view.forPlayer) return;
      setView(view);
    };

    const handleScoresUpdated = (payload: GameScoresPayload) => {
      if (payload.gameId !== gameId) return;
      setScores(payload.scores);
    };

    const handleTimerStarted = (payload: GameTimerPayload) => {
      if (payload.gameId !== gameId) return;
      setTimer(payload);
      setTimerStartedSignal(Date.now());
    };

    const handleTimerUpdated = (payload: GameTimerPayload) => {
      if (payload.gameId !== gameId) return;
      setTimer(payload);
    };

    socket.on("gameWatched", handleWatched);
    socket.on("gamePlayersUpdated", handlePlayersUpdated);
    socket.on("gameScoresUpdated", handleScoresUpdated);
    socket.on("gameTimerStarted", handleTimerStarted);
    socket.on("gameTimerUpdated", handleTimerUpdated);
    socket.on("gameStateUpdated", handleStateUpdated);
    socket.emit("gameWatch", { auth, payload: gameId });

    return () => {
      socket.off("gameWatched", handleWatched);
      socket.off("gamePlayersUpdated", handlePlayersUpdated);
      socket.off("gameScoresUpdated", handleScoresUpdated);
      socket.off("gameTimerStarted", handleTimerStarted);
      socket.off("gameTimerUpdated", handleTimerUpdated);
      socket.off("gameStateUpdated", handleStateUpdated);
    };
  }, [gameId, socket, userPlayerIndex, auth]);

  function joinGame() {
    socket.emit("gameJoinAsPlayer", { auth, payload: gameId });
  }

  function startGame() {
    socket.emit("gameStart", { auth, payload: gameId });
  }

  return {
    hasWatched,
    players,
    scores,
    timer,
    timerStartedSignal,
    userPlayerIndex,
    view,
    joinGame,
    startGame,
  };
}
