import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useLobbyList from "../hooks/useLobbyList.ts";
import useAuth from "../hooks/useAuth.ts";
import { joinLobbyByCode } from "../services/lobbyService.ts";

export default function LobbyList() {
  const auth = useAuth();
  const navigate = useNavigate();
  const lobbies = useLobbyList();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const handleJoinByCode = async () => {
    setErr(null);
    const result = await joinLobbyByCode(auth, code.trim().toUpperCase());
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    navigate(`/lobby/${result.lobbyId}`);
  };

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Lobbies</h2>
        <div>
          <button className="primary narrow" onClick={() => navigate("/lobby/new")}>
            Create Lobby
          </button>
        </div>
      </div>

      <div className="spacedSection">
        <h3>Join by Code</h3>
        <div className="alignCenter">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter lobby code"
            aria-label="Lobby code"
          />
          <button className="primary narrow" onClick={handleJoinByCode}>
            Join
          </button>
        </div>
        {err && <p className="error-message">{err}</p>}
      </div>

      <div className="spacedSection">
        <h3>Public Lobbies</h3>
        {"message" in lobbies ? (
          <div>{lobbies.message}</div>
        ) : (
          <div className="dottedList" role="list">
            {lobbies.map((lobby) => (
              <div className="dottedListItem" role="listitem" key={lobby.lobbyId}>
                <div>
                  {lobby.type} lobby by {lobby.createdBy.username}
                </div>
                <div>
                  {lobby.players.filter((p) => p.status === "joined").length} players joined
                </div>
                <button
                  className="primary narrow"
                  onClick={() => navigate(`/lobby/${lobby.lobbyId}`)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
