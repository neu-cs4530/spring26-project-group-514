import "./Game.css";
import { useParams } from "react-router-dom";
import { getGameById } from "../services/gameService.ts";
import { useEffect, useState } from "react";
import type { GameInfo } from "@gamenite/shared";
import ChatPanel from "../components/ChatPanel.tsx";
import GamePanel from "../components/GamePanel.tsx";
import ActionErrorBanner from "../components/ActionErrorBanner.tsx";
import useAuth from "../hooks/useAuth.ts";

export default function Game() {
  const { gameId } = useParams();
  const auth = useAuth();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      // non-nullish assertion is ok here given that Game is only called in a
      // route with `:gameId`
      const result = await getGameById(gameId!, auth);
      if (ignore) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setGame(result);
    })();
    return () => {
      ignore = true;
    };
  }, [gameId, auth]);

  if (error) return <ActionErrorBanner error={error} />;

  return (
    game && (
      <>
        <div className="gameContainer">
          <GamePanel {...game} />
          <ChatPanel chatId={game.chat} />
        </div>
      </>
    )
  );
}
