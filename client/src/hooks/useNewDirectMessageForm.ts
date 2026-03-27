import { type ChangeEvent, type SubmitEvent, useState } from "react";

/**
 * Custom hook to manage the state and submission of a new direct message form.
 * Mirrors the pattern of useNewCommentForm.
 * @param handleMessageCreation - callback from useSocketsForDM to send the message
 * @returns form state and handlers
 */
export default function useNewDirectMessageForm(handleMessageCreation: (text: string) => void): {
  text: string;
  handleSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
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

  return { text, handleSubmit, handleInputChange };
}
