import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddFriendForm from "../../src/components/AddFriendForm.tsx";

const onSend = vi.fn();

describe("AddFriendForm component", () => {
  beforeEach(() => {
    onSend.mockReset();
  });

  it("calls onSend with the typed username when Send Request is clicked", async () => {
    onSend.mockResolvedValue(null);
    render(<AddFriendForm onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "user2" } });
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() => expect(onSend).toHaveBeenCalledExactlyOnceWith("user2"));
  });

  it("calls onSend when Enter is pressed in the input", async () => {
    onSend.mockResolvedValue(null);
    render(<AddFriendForm onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "user2" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(onSend).toHaveBeenCalledExactlyOnceWith("user2"));
  });

  it("shows 'Request sent!' after a successful send", async () => {
    onSend.mockResolvedValue(null);
    render(<AddFriendForm onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "user2" } });
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() => expect(screen.getByText("Request sent!")).not.toBeNull());
  });

  it("shows a failure status when onSend returns an error", async () => {
    onSend.mockResolvedValue("User not found");
    render(<AddFriendForm onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nobody" } });
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() => expect(screen.getByText(/failed to send request/i)).not.toBeNull());
  });

  it("does not call onSend when the input is empty", async () => {
    render(<AddFriendForm onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onSend).not.toHaveBeenCalled();
  });
});
