import "./NewDirectMessage.css";
import useNewDirectMessageForm from "../hooks/useNewDirectMessageForm.ts";

interface NewDirectMessageProps {
  handleMessageCreation: (text: string) => void;
}

/**
 * Allows the user to send a new message in a DM conversation.
 * Mirrors the structure of MessageCreation.
 */
export default function NewDirectMessage({ handleMessageCreation }: NewDirectMessageProps) {
  const { text, handleSubmit, handleInputChange, handleKeyDown } =
    useNewDirectMessageForm(handleMessageCreation);

  return (
    <form className="newDirectMessage" onSubmit={handleSubmit}>
      <textarea
        placeholder="Send a message"
        value={text}
        onKeyDown={handleKeyDown}
        onChange={handleInputChange}
      />
      <button className="visuallyHidden">Submit</button>{" "}
      {/*visuallyHidden=invis, primary narrow=shown */}
    </form>
  );
}
