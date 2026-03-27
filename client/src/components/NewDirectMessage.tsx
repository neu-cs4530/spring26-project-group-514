import "./NewDirectMessage.css";
import useNewDirectMessageForm from "../hooks/useNewDirectMessageForm.ts";

interface NewDirectMessageProps {
  handleMessageCreation: (text: string) => void;
}

/**
 * Allows the user to send a new message in a DM conversation.
 * Mirrors the structure of NewForumComment.
 */
export default function NewDirectMessage({ handleMessageCreation }: NewDirectMessageProps) {
  const { text, handleSubmit, handleInputChange } = useNewDirectMessageForm(handleMessageCreation);

  return (
    <form className="newDirectMessage" onSubmit={handleSubmit}>
      <textarea
        className="notTooWide"
        placeholder="Send a message"
        value={text}
        onChange={handleInputChange}
      />
      <div>
        <button className="primary narrow">Send</button>
      </div>
    </form>
  );
}
