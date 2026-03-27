import { useState, type ChangeEvent, type ComponentProps } from "react";
import type { GameKey } from "@gamenite/shared";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import { createLobby } from "../services/lobbyService.ts";
import { gameNames } from "../util/consts.ts";

export default function NewLobby() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<GameKey | "">("");
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  type FormSubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

  const onSubmit = async (e: FormSubmitEvent) => {
    e.preventDefault();
    if (!type) {
      setErr("Please select a game type");
      return;
    }

    const lobby = await createLobby(auth, { type, isPrivate });
    if ("error" in lobby) {
      setErr(lobby.error);
      return;
    }

    navigate(`/lobby/${lobby.lobbyId}`);
  };

  const onGameChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setType(e.target.value as GameKey | "");
    setErr(null);
  };

  return (
    <form className="content spacedSection" onSubmit={onSubmit}>
      <h2>Create Lobby</h2>
      <div>
        <select value={type} aria-label="Game selection" onChange={onGameChange}>
          <option value="">- Select a game -</option>
          {Object.entries(gameNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private Lobby
      </label>
      {err && <p className="error-message">{err}</p>}
      <div>
        <button className="primary narrow">Create</button>
      </div>
    </form>
  );
}
