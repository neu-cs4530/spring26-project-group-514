import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeaderboardEntry, LeaderboardPeriod, PaginatedResponse } from "@gamenite/shared";
import { getLeaderboard } from "../services/statsService.ts";
import "./Leaderboard.css";

const PERIODS: { label: string; value: LeaderboardPeriod }[] = [
  { label: "All Time", value: "all" },
  { label: "This Month", value: "month" },
  { label: "This Week", value: "week" },
];

export default function Leaderboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResponse<LeaderboardEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const limit = 10;

  useEffect(() => {
    getLeaderboard(page, limit, period).then((res) => {
      if (!("error" in res)) setData(res);
    });
  }, [page, period]);

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Leaderboard</h2>

        <div className="leaderboard-filters">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`narrow ${period === p.value ? "primary" : "secondary"}`}
              onClick={() => {
                setPeriod(p.value);
                setPage(1);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {!data ? (
          <div>Loading...</div>
        ) : data.data.length === 0 ? (
          <div>No leaderboard data yet. Play some games!</div>
        ) : (
          <>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Games</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((entry) => (
                  <tr
                    key={entry.username}
                    className="leaderboard-row"
                    onClick={() => navigate(`/profile/${entry.username}`)}
                  >
                    <td className="centered">{entry.rank}</td>
                    <td>{entry.display}</td>
                    <td className="centered">{entry.wins}</td>
                    <td className="centered">{entry.losses}</td>
                    <td className="centered">{entry.gamesPlayed}</td>
                    <td className="centered">{(entry.winRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="leaderboard-pagination">
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
