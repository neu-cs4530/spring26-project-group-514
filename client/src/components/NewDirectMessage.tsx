import "./NewDirectMessage.css";
import useNewDirectMessageForm from "../hooks/useNewDirectMessageForm.ts";
import EmojiPicker from "./EmojiPicker.tsx";

interface NewDirectMessageProps {
  handleMessageCreation: (text: string) => void;
}

export default function NewDirectMessage({ handleMessageCreation }: NewDirectMessageProps) {
  const { text, handleSubmit, handleInputChange, handleKeyDown, appendEmoji } =
    useNewDirectMessageForm(handleMessageCreation);

  return (
    <form className="newDirectMessage" onSubmit={handleSubmit}>
      <EmojiPicker onSelect={appendEmoji} />
      <textarea
        placeholder="Send a message"
        value={text}
        onKeyDown={handleKeyDown}
        onChange={handleInputChange}
      />
      <button className="visuallyHidden">Submit</button>
    </form>
  );
}
