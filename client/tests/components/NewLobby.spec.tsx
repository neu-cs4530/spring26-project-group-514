import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewLobby from "../../src/pages/NewLobby.tsx";

const mockedUseNavigate = vi.fn();
const mockedCreateLobby = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockedUseNavigate };
});

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ username: "user1", password: "pwd1111" }),
}));

vi.mock("../../src/services/lobbyService.ts", () => ({
  createLobby: mockedCreateLobby,
}));

describe("NewLobby page", () => {
  beforeEach(() => {
    mockedUseNavigate.mockReset();
    mockedCreateLobby.mockReset();
  });

  it("creates a private lobby by default", async () => {
    mockedCreateLobby.mockResolvedValue({ lobbyId: "lobby-1" });

    render(<NewLobby />);

    fireEvent.change(screen.getByLabelText("Game selection"), { target: { value: "nim" } });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockedCreateLobby).toHaveBeenCalledExactlyOnceWith(
        { username: "user1", password: "pwd1111" },
        { type: "nim", isPrivate: true },
      );
      expect(mockedUseNavigate).toHaveBeenCalledExactlyOnceWith("/lobby/lobby-1");
    });
  });

  it("creates a public lobby when private toggle is unchecked", async () => {
    mockedCreateLobby.mockResolvedValue({ lobbyId: "lobby-2" });

    render(<NewLobby />);

    fireEvent.change(screen.getByLabelText("Game selection"), { target: { value: "guess" } });
    fireEvent.click(screen.getByLabelText("Private Lobby"));
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockedCreateLobby).toHaveBeenCalledExactlyOnceWith(
        { username: "user1", password: "pwd1111" },
        { type: "guess", isPrivate: false },
      );
      expect(mockedUseNavigate).toHaveBeenCalledExactlyOnceWith("/lobby/lobby-2");
    });
  });
});
