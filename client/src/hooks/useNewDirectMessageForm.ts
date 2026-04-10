import { type ChangeEvent, type KeyboardEvent, type SubmitEvent, useState } from "react";

export default function useNewDirectMessageForm(handleMessageCreation: (text: string) => void): {
  text: string;
  handleSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  appendEmoji: (emoji: string) => void;
} {
  const [text, setText] = useState("");

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    handleMessageCreation(trimmed);
    setText("");
  }

  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.code === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed) return;
      handleMessageCreation(trimmed);
      setText("");
    }
  }

  function appendEmoji(emoji: string) {
    setText((prev) => prev + emoji);
  }

  return { text, handleSubmit, handleInputChange, handleKeyDown, appendEmoji };
}
