import { useState } from "react";

/**
 * A simple form to send a friend request by username.
 * Mirrors the shape of NewForumComment — takes an onSend callback
 * rather than calling the service directly.
 */
export default function AddFriendForm({
  onSend,
}: {
  onSend: (toUsername: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus(null);
    try {
      await onSend(trimmed);
      setValue("");
      setStatus("Request sent!");
    } catch {
      setStatus("Failed to send request. Check the username and try again.");
    }
  };

  return (
    <div className="spacedSection">
      <h3>Add a Friend</h3>
      <div>
        <input
          type="text"
          placeholder="Enter username..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className="primary narrow" onClick={handleSend}>
          Send Request
        </button>
      </div>
      {status && <div className="smallAndGray">{status}</div>}
    </div>
  );
}
