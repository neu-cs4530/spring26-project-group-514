import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MatchHistoryEntry, PaginatedResponse } from "@gamenite/shared";
import { getMatchHistory } from "../services/statsService.ts";
import useAuth from "../hooks/useAuth.ts";
import "./MatchHistory.css";

export default function MatchHistory() {
  const { username } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResponse<MatchHistoryEntry> | null>(null);
  const [page, setPage] = useState(1);

  // Filters
  const [gameType, setGameType] = useState("");
  const [opponent, setOpponent] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const limit = 10;

  useEffect(() => {
    const filters = {
      gameType: gameType || undefined,
      opponent: opponent || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    getMatchHistory(username, page, limit, filters).then((res) => {
      if (!("error" in res)) setData(res);
    });
  }, [username, page, gameType, opponent, dateFrom, dateTo]);

  const resultClass = (result: string) => {
    if (result === "win") return "result-win";
    if (result === "loss") return "result-loss";
    return "result-draw";
  };

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Match History</h2>

        <div className="history-filters">
          <select
            value={gameType}
            onChange={(e) => {
              setGameType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Games</option>
            <option value="nim">Nim</option>
            <option value="guess">Guess</option>
          </select>
          <input
            type="text"
            placeholder="Filter by opponent"
            value={opponent}
            onChange={(e) => {
              setOpponent(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {!data ? (
          <div>Loading...</div>
        ) : data.data.length === 0 ? (
          <div>No match history found.</div>
        ) : (
          <>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Players</th>
                  <th>Result</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((entry) => (
                  <tr key={entry.gameId} className="history-row">
                    <td>{entry.type}</td>
                    <td>
                      {entry.players
                        .filter((p) => p !== username)
                        .map((p) => (
                          <span
                            key={p}
                            className="player-link"
                            onClick={() => navigate(`/profile/${p}`)}
                          >
                            {p}
                          </span>
                        ))}
                    </td>
                    <td>
                      <span className={resultClass(entry.result)}>
                        {entry.result.toUpperCase()}
                      </span>
                    </td>
                    <td className="smallAndGray">{new Date(entry.endedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="history-pagination">
              <button
                className="narrow secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              <button
                className="narrow secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
