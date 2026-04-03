import "./GamePanel.css";
import { useEffect, useState } from "react";
import type { GameInfo } from "@gamenite/shared";
import { gameNames } from "../util/consts.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import GameDispatch from "../games/GameDispatch.tsx";
import useSocketsForGame from "../hooks/useSocketsForGame.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";

/**
 * A game panel allows viewing the status and players of a live game
 */
export default function GamePanel({
  gameId,
  type,
  players: initialPlayers,
  createdAt,
  minPlayers,
}: GameInfo) {
  const { user } = useLoginContext();
  const timeSince = useTimeSince();

  const {
    view,
    players,
    scores,
    timer,
    timerStartedSignal,
    userPlayerIndex,
    hasWatched,
    joinGame,
    startGame,
  } = useSocketsForGame(gameId, initialPlayers);
  const [nowMs, setNowMs] = useState(0);
  const showTimerStartNotice = timerStartedSignal > 0 && nowMs - timerStartedSignal < 2500;

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!timerStartedSignal) return;

    // Play a short beep when the timer starts.
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.05;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore browser audio restrictions.
    }
  }, [timerStartedSignal]);

  return hasWatched ? (
    <div className="gamePanel">
      <div className="gameRoster">
        <h2>{gameNames[type]}</h2>
        <div className="smallAndGray">Game room created {timeSince(createdAt)}</div>
        {timer && (
          <div className={`gameTimer ${timer.isRunning ? "running" : "stopped"}`}>
            Match timer: {Math.max(0, timer.remainingSeconds)}s
          </div>
        )}
        {showTimerStartNotice && <div className="timerStartNotice">Timer started</div>}
        <div className="dottedList" role="list">
          {players.map((player, index) => (
            <div className="dottedListItem" role="listitem" key={player.username}>
              {player.username === user.username ? (
                `you are player #${index + 1}`
              ) : (
                <span>
                  Player #{index + 1} is <UserLink user={player} />
                </span>
              )}
            </div>
          ))}
        </div>
        {view && (
          <div className="spacedSection">
            <h3>Current Scores</h3>
            <div className="dottedList" role="list">
              {players.map((player, index) => (
                <div className="dottedListItem" role="listitem" key={`${player.username}-score`}>
                  <span>
                    Player #{index + 1} (<UserLink user={player} />)
                  </span>
                  <strong>{scores.find((score) => score.playerIndex === index)?.score ?? 0}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
        {
          // If the game hasn't started and user hasn't joined, they can join
          userPlayerIndex < 0 && !view && (
            <button className="primary narrow" onClick={joinGame}>
              Join Game
            </button>
          )
        }
        {
          // If the game hasn't started and the user has joined, they can start the game if a minimum number of players are present
          userPlayerIndex >= 0 && !view && players.length >= minPlayers && (
            <button className="primary narrow" onClick={startGame}>
              Start Game
            </button>
          )
        }
      </div>
      {view ? (
        <div className="gameFrame">
          <GameDispatch
            gameId={gameId}
            userPlayerIndex={userPlayerIndex}
            players={players}
            view={view}
          />
        </div>
      ) : (
        <div className="gameFrame waiting content">waiting for game to begin</div>
      )}
    </div>
  ) : (
    <div></div>
  );
}
