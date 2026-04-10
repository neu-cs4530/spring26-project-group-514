import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useLobbyList from "../hooks/useLobbyList.ts";
import useAuth from "../hooks/useAuth.ts";
import { joinLobbyByCode, joinLobbyById } from "../services/lobbyService.ts";
import UserLink from "../components/UserLink.tsx";
import "./LobbyList.css";

export default function LobbyList() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { publicLobbies, invitedLobbies } = useLobbyList();
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
    <div className="content lobbylist-page">
      <div className="spacedSection">
        <h2>Lobbies</h2>
        <div>
          <button className="primary narrow" onClick={() => navigate("/lobby/new")}>
            Create Lobby
          </button>
        </div>
      </div>

      <div className="spacedSection">
        <h2>Join by Code</h2>
        <div className="join-code-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
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
        <h2>Public Lobbies</h2>
        {!publicLobbies ? (
          <div>Loading...</div>
        ) : "error" in publicLobbies ? (
          <div>{publicLobbies.error}</div>
        ) : publicLobbies.length === 0 ? (
          <div>No public lobbies found.</div>
        ) : (
          <div className="list" role="list">
            {publicLobbies.map((lobby) => (
              <div role="listitem" key={lobby.lobbyId}>
                <div className="lobby-item-info">
                  <div>
                    {lobby.type} lobby by <UserLink user={lobby.createdBy} />
                  </div>
                  <span className="smallAndGray">
                    {lobby.players.filter((p) => p.status === "joined").length} players joined
                  </span>
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

      <div className="spacedSection">
        <h2>Invited Lobbies</h2>
        {!invitedLobbies ? (
          <div>Loading...</div>
        ) : "error" in invitedLobbies ? (
          <div>{invitedLobbies.error}</div>
        ) : invitedLobbies.length === 0 ? (
          <div>No lobby invitations found.</div>
        ) : (
          <div className="list" role="list">
            {invitedLobbies.map((lobby) => (
              <div role="listitem" key={lobby.lobbyId}>
                <div className="lobby-item-info">
                  <div>
                    {lobby.type} lobby by <UserLink user={lobby.createdBy} />
                  </div>
                  <span className="smallAndGray">
                    {lobby.players.filter((p) => p.status === "joined").length} players joined
                  </span>
                </div>
                <button
                  className="secondary narrow"
                  onClick={async () => {
                    const result = await joinLobbyById(auth, lobby.lobbyId);
                    if ("error" in result) {
                      setErr(result.error);
                      return;
                    }
                    navigate(`/lobby/${result.lobbyId}`);
                  }}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
